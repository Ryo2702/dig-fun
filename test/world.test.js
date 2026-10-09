import test from 'node:test'
import assert from 'node:assert/strict'
import { createGame, step, tile, targetInfo, safeBelow, interact, restore, serialize, DEFAULT_SETTINGS, TOOLS, keyOf, scan, reveal } from '../src/utils/world.js'
const tick = (g, input = {}, seconds = 1) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) step(g, input, 1 / 60) }
test('waiting and horizontal movement do not increase physical depth', () => {
  const g = createGame(); tick(g, {}, 5); assert.equal(g.deepest, 0)
  tick(g, { right: true }, .8); assert.ok(g.player.x > 11); assert.equal(g.deepest, 0)
})
test('distant and protected blocks cannot be mined', () => {
  const g = createGame(); tick(g); g.target = { x: 20, y: 20 }; tick(g, { mine: true }, 5)
  assert.equal(g.broken, 0); assert.equal(g.notice, 'Too far away. Move closer.')
  g.player.x = 1.15; g.player.y = 7.1; g.target = { x: 0, y: 7 }; tick(g, { mine: true }); assert.equal(g.broken, 0)
})
test('downward mining breaks only the selected block, descends physically, and stops on release', () => {
  const g = createGame(); g.player.x = 10.15; tick(g); g.target = { x: 10, y: 8 }
  assert.equal(targetInfo(g).locked, false); tick(g, { mine: true }, .6)
  assert.equal(tile(g, 10, 8), 'air'); assert.equal(g.broken, 1)
  tick(g, {}, 2); assert.equal(g.broken, 1); assert.equal(g.deepest, .1); assert.equal(tile(g, 10, 9), 'soil')
})
test('safe downward checks reject lava and long falls', () => {
  const g = createGame(); for (let y = 9; y < 15; y++) g.removed[keyOf(10, y)] = true
  assert.equal(safeBelow(g, 10, 8), false)
  g.player.x = 10.15; tick(g); g.target = { x: 10, y: 8 }; assert.match(targetInfo(g).reason, /Unsafe/)
})
test('jump returns to solid ground and walls prevent walking through terrain', () => {
  const g = createGame(); tick(g); const ground = g.player.y
  tick(g, { jump: true }, .2); assert.ok(g.player.y < ground - .5)
  tick(g, {}, 2); assert.ok(Math.abs(g.player.y - ground) < .02)
  tick(g, { right: true }, 8); assert.ok(g.player.x < 19)
})
test('drills overheat and cool without permanent tool destruction', () => {
  const g = createGame(); g.broken = 20; g.tool = 2; g.heat = 99; tick(g, {}, .02); g.target = { x: 9, y: 8 }
  tick(g, { mine: true }, .02); assert.ok(g.cooldown > 0); assert.equal(g.tool, 2)
  tick(g, {}, 4); assert.equal(g.cooldown, 0); assert.ok(g.heat < 10)
})
test('ore requires proximity and is collected once', () => {
  const g = createGame(); g.drops.push({ x: 15, y: 7, type: 'gold', amount: 2, born: -1 }); tick(g)
  assert.equal(g.inventory.gold, undefined); g.player.x = 15.1; tick(g)
  assert.equal(g.inventory.gold, 2); tick(g); assert.equal(g.inventory.gold, 2)
})
test('artifacts require interaction and only puzzle outcomes open the journal', () => {
  const g = createGame(); g.player.x = 18.15; tick(g); g.target = { x: 19, y: 7 }; tick(g, { mine: true })
  assert.equal(g.artifacts.length, 0); assert.equal(interact(g), undefined); assert.equal(g.artifacts[0].outcome, 'component'); assert.equal(g.broken, 6)
  interact(g); assert.equal(g.artifacts.length, 1)
  const puzzle = createGame(); puzzle.player.x = 11.15; puzzle.player.y = 26.1
  assert.equal(interact(puzzle), 'journal'); assert.equal(puzzle.artifacts[0].outcome, 'puzzle')
})
test('save round trip retains damage, inventory, location, and unfinished puzzles', () => {
  const g = createGame(); g.damage['9,8'] = 1; g.inventory.gold = 2; g.artifacts = [{ id: '12,26', outcome: 'puzzle', turns: 2, solved: false }]
  const { g: next } = restore(JSON.parse(JSON.stringify(serialize(g, DEFAULT_SETTINGS))))
  assert.equal(next.damage['9,8'], 1); assert.equal(next.inventory.gold, 2); assert.equal(next.artifacts[0].turns, 2); assert.equal(next.player.x, g.player.x)
})
test('untrusted saves cannot inject out of range state or unknown ore types', () => {
  const { g, settings } = restore({ version: 2, player: { x: Infinity, y: -2 }, removed: { '-1,3': true, '999,2': true, '10,8': true }, tool: 99, deepest: 999999, inventory: { gold: -1, sol: 3, fake: 44 }, artifacts: [null], settings: { opacity: 4, keys: { left: 'javascript' } } })
  assert.equal(g.player.x, 9.15); assert.equal(g.deepest, 0); assert.equal(g.tool, 0); assert.deepEqual(g.removed, { '10,8': true }); assert.deepEqual(g.inventory, { sol: 3 }); assert.equal(settings.opacity, .85)
})
test('scanner and camera exploration never advance depth or expose rooms through stone', () => {
  const g = createGame(); reveal(g); assert.equal(g.seen['9,12'], undefined); scan(g); tick(g); assert.equal(g.deepest, 0); assert.equal(g.seen['9,12'], undefined)
})
test('all unlock levels have a route through ordinary mineable blocks', () => {
  assert.deepEqual(TOOLS.map(t => t.unlock), [0, 6, 20, 45, 75, 110, 140])
  const g = createGame(); g.tool = 5; g.broken = 110; tick(g); g.target = { x: 9, y: 8 }; assert.match(targetInfo(g).reason, /casings only/)
})

test('a quick jump press is consumed once, even after keyup before a frame', () => {
  const g = createGame(); tick(g); const y = g.player.y, input = { jumpPressed: true }
  step(g, input, 1 / 60); assert.ok(g.player.y < y); assert.equal(input.jumpPressed, false)
})
test('artifact dials preserve unfinished state and unlock only the correct sequence', async () => {
  const { turnDial } = await import('../src/utils/world.js')
  const g = createGame(), a = { id: '12,26', outcome: 'puzzle', dials: [0, 0, 0], solved: false }; g.artifacts.push(a)
  turnDial(g, a, 0); assert.equal(a.solved, false)
  const { g: restored } = restore(serialize(g, DEFAULT_SETTINGS)); assert.deepEqual(restored.artifacts[0].dials, [1, 0, 0])
  turnDial(g, a, 1); assert.equal(a.solved, false); turnDial(g, a, 1); assert.equal(a.solved, true)
  turnDial(g, a, 2); assert.deepEqual(a.dials, [1, 2, 0])
})

test('downward digging plants the miner over the tile when standing across a seam', () => {
  const g = createGame(); g.player.x = 10.67; tick(g); g.target = { x: 10, y: 8 }; tick(g, { mine: true }, .7)
  tick(g); assert.equal(g.broken, 1); assert.equal(g.deepest, .1)
})
