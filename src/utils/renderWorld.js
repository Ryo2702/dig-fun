import { TILE, WIDTH, HEIGHT, tile, solid, playerTile, targetInfo, keyOf, hash, zoneAt, ORE_COLORS, TOOLS } from './world.js'
const palettes = [
  ['#171816', '#403129', '#5d4734', '#81603d', '#aa8150'],
  ['#111b1c', '#283b38', '#3e5148', '#536553', '#859578'],
  ['#201c23', '#453b43', '#61515d', '#84666e', '#ad8586'],
  ['#171b24', '#343d4c', '#495366', '#687589', '#98a4b2'],
  ['#251818', '#51302c', '#714136', '#9c5940', '#b78356'],
  ['#1c1728', '#393048', '#53425f', '#705979', '#a685ac'],
]
let atlas
function sprites() {
  if (atlas) return atlas
  atlas = document.createElement('canvas'); atlas.width = 20 * 16; atlas.height = 24
  const c = atlas.getContext('2d'); c.imageSmoothingEnabled = false
  for (let f = 0; f < 20; f++) {
    const x = f * 16, crouch = f === 9 || f === 12 || f === 13, bob = [1, 3, 5, 15].includes(f) ? 1 : 0, y = crouch ? 4 : bob
    const r = (a, b, w, h, color) => { c.fillStyle = color; c.fillRect(x + a, y + b, w, h) }
    r(4, 9, 8, 10, '#161717'); r(5, 10, 6, 7, '#648778'); r(4, 11, 3, 7, '#385d52')
    r(3, 2, 10, 6, '#312820'); r(4, 1, 8, 5, '#e2a740'); r(3, 5, 11, 2, '#ffe19a'); r(11, 3, 3, 3, '#f7f0c3')
    r(6, 7, 7, 5, '#d0a57b'); r(10, 7, 1, 1, '#29251f'); r(10, 9, 3, 1, '#49392c'); r(5, 8, 2, 4, '#86694e')
    r(6, 13, 1, 4, '#9fb192'); r(4, 17, 8, 2, '#7f643f'); r(9, 17, 2, 1, '#edc766')
    const stride = f >= 1 && f <= 5 ? (f % 2 ? 2 : -2) : 0
    r(5 + stride, 19 - (crouch ? 3 : 0), 3, 3, '#657378'); r(9 - stride, 19 - (crouch ? 3 : 0), 3, 3, '#849292')
    r(4 + stride, 22 - (crouch ? 3 : 0), 4, 2 - bob, '#b09b78'); r(9 - stride, 22 - (crouch ? 3 : 0), 4, 2 - bob, '#b09b78')
    if (f === 15 || f === 16) { r(1, 8, 3, 5, '#d0a57b'); r(12, 8, 3, 5, '#d0a57b') }
    else if (f >= 10 && f <= 13) { r(10, f === 11 ? 7 : 13, 5, 3, '#d0a57b') }
    else { r(10, 12, 3, 5, '#d0a57b'); r(2, 12, 3, 4, '#86694e') }
    if (f === 17) { r(4, 12, 10, 7, '#c59d58'); r(7, 13, 3, 3, '#714a35') }
    if (f === 18) { r(5, 7, 8, 2, '#c37665') }
  }
  return atlas
}
export function drawWorld(ctx, g, camera, width, height, settings, inspect = 0, crew = null) {
  ctx.imageSmoothingEnabled = false
  const p = g.player, palette = palettes[zoneAt(p.y)], targetX = Math.max(0, Math.min(WIDTH * TILE - width, (p.x + .325) * TILE - width * .43 + p.facing * 22 + inspect)), targetY = Math.max(0, Math.min(HEIGHT * TILE - height, p.y * TILE - height * .43))
  camera.x += (targetX - camera.x) * (settings.reduced ? 1 : .12); camera.y += (targetY - camera.y) * (settings.reduced ? 1 : .14)
  const bump = settings.shake && !settings.reduced && g.shake > 0 ? (Math.floor(g.time * 70) % 2 ? 1 : -1) * (g.shake > .1 ? 3 : 1) : 0
  camera.drawX = Math.round(camera.x) + bump; camera.drawY = Math.round(camera.y)
  const cx = camera.drawX, cy = camera.drawY
  ctx.fillStyle = '#111311'; ctx.fillRect(0, 0, width, height)
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x - cx), Math.round(y - cy), w, h) }
  const text = (s, x, y, color = '#ac9a76') => { ctx.font = '7px monospace'; ctx.fillStyle = color; ctx.fillText(s, Math.round(x - cx), Math.round(y - cy)) }
  for (let y = Math.max(0, Math.floor(cy / TILE)); y <= Math.min(HEIGHT - 1, Math.ceil((cy + height) / TILE)); y++) for (let x = Math.max(0, Math.floor(cx / TILE)); x <= Math.min(WIDTH - 1, Math.ceil((cx + width) / TILE)); x++) {
    const px = x * TILE, py = y * TILE, id = keyOf(x, y), seen = g.seen[id], type = tile(g, x, y), pal = palettes[zoneAt(y)], n = hash(x, y)
    if (!seen) {
      rect(px, py, 16, 16, y < 8 ? '#141813' : '#20231b')
      rect(px + 1, py + 1, 14, 1, '#292c21'); rect(px + 15, py + 2, 1, 14, '#181d16')
      rect(px + 2 + n % 7, py + 4 + n % 6, 3, 1, '#2b2d22')
      if (n % 3 === 0) { rect(px + 3, py + 11, 6, 1, '#191e16'); rect(px + 8, py + 12, 1, 2, '#191e16') }
      continue
    }
    if (solid(type)) {
      rect(px, py, 16, 16, pal[1]); rect(px + 1, py + 1, 14, 13, pal[2]); rect(px + 1, py + 1, 13, 1, pal[3]); rect(px + 2, py + 14, 12, 1, '#211e1b')
      rect(px + 2 + n % 5, py + 3, 3 + n % 4, 2, pal[3]); rect(px + 8, py + 9, 5, 2, pal[1]); rect(px + 4, py + 11, 2, 1, pal[4]); rect(px + 1, py + 7, 1, 4, pal[1])
      if (type === 'soil') { for (let i = 0; i < 5; i++) rect(px + (n + i * 3) % 14, py + (n + i * 7) % 14, 1, 1, pal[4]) }
      if (type === 'casing') { rect(px + 3, py + 2, 10, 12, '#a38a54'); rect(px + 4, py + 3, 8, 10, '#473f31'); rect(px + 7, py + 4, 2, 7, '#d7bc77'); rect(px + 6, py + 6, 4, 2, '#d7bc77') }
      if (type === 'sealed') { rect(px + 2, py + 3, 12, 2, '#a18dac'); rect(px + 6, py + 5, 3, 8, '#a18dac') }
      if (type === 'debris') { rect(px, py, 16, 5, pal[0]); rect(px + 3, py + 5, 9, 5, pal[3]) }
      const damage = g.damage[id] || 0
      if (damage) {
        const stage = Math.min(3, Math.ceil(damage / ({soil:1, loose:3,stone:5,hard:9,copper:6,silver:10,gold:12,diamond:18,sol:20,sealed:8}[type] || 5) * 3))
        for (let i = 0; i < 3 + stage * 2; i++) rect(px + 7 + (i % 3 - 1), py + 2 + i, 1, 2, '#131511')
        if (stage > 1) { rect(px + 4, py + 6, 4, 1, '#131511'); rect(px + 3, py + 7, 2, 3, '#131511') }
        if (stage > 2) { rect(px + 8, py + 9, 5, 1, '#131511'); rect(px + 12, py + 9, 1, 4, '#131511') }
      }
      const distance = Math.hypot(x - p.x, y - p.y), glint = !settings.reduced && distance < (g.tool >= 3 ? 4 : 3) && ((g.time + n / 500) % 9 < .18 || g.scanner > 0 && (g.time * 2 + n / 100) % 2 < .25)
      if (glint && (ORE_COLORS[type] || n % 13 === 0)) {
        const color = ORE_COLORS[type] || '#c4c6a8'; rect(px + 7, py + 6, 1, 5, color); rect(px + 5, py + 8, 5, 1, color)
        if (['diamond', 'sol'].includes(type)) { rect(px + 5, py + 6, 1, 1, color); rect(px + 9, py + 10, 1, 1, type === 'sol' ? '#88e4ac' : color) }
        if (type === 'gold') rect(px + 6, py + 7, 3, 3, color)
        if (type === 'copper') rect(px + 8, py + 5, 2, 2, color)
        if (g.scanner > 0) text('?', px + 11, py + 6, color)
      }
    } else {
      rect(px, py, 16, 16, pal[0]); rect(px, py + 15, 16, 1, '#20221d'); if (n % 3 === 0) { rect(px + 3, py + 5, 5, 1, pal[1]); rect(px + 7, py + 6, 1, 3, pal[1]) }
      if (type === 'ladder') { rect(px + 3, py, 2, 16, '#a98652'); rect(px + 11, py, 2, 16, '#a98652'); for (let j = 2; j < 16; j += 5) rect(px + 5, py + j, 6, 2, '#7c6747') }
      if (type === 'lava') { rect(px, py + 5, 16, 11, '#b45436'); rect(px, py + 5, 16, 2, '#f2aa4e'); for (let i = 0; i < 3; i++) rect(px + (i * 5 + Math.floor(g.time * 3)) % 14, py + 8, 2, 2, '#f5c370') }
      if (y === 7 && x >= 3 && x <= 18) { rect(px, py + 14, 16, 2, '#877553'); rect(px, py + 15, 16, 1, '#b09265') }
      if (x % 6 === 3 && y % 14 === 11) { rect(px + 2, py - 16, 3, 47, '#624f37'); rect(px, py - 17, 20, 3, '#8b704b'); rect(px + 7, py - 14, 1, 5, '#79613e'); rect(px + 5, py - 9, 5, 6, '#e4b65b'); rect(px + 6, py - 8, 3, 3, '#ffe4a0') }
    }
    const distance = Math.hypot((px + 8) - (p.x + .3) * TILE, (py + 8) - (p.y + .45) * TILE)
    if (distance > 72) for (let a = 0; a < 16; a += 2) for (let b = 0; b < 16; b += 2) if (distance > 118 || (a + b) % 4 === 0) rect(px + a, py + b, 1, 1, '#111311')
  }
  // The entrance is assembled from the same low-resolution pixel primitives as the world.
  if (g.seen['9,5']) {
    rect(8 * 16, 4 * 16, 79, 19, '#71583b'); rect(8 * 16 + 2, 4 * 16 + 2, 75, 15, '#2a2c24'); text('ONE MORE BLOCK', 8 * 16 + 7, 4 * 16 + 12, '#d8bd83')
    rect(8 * 16 + 5, 4 * 16 + 19, 3, 28, '#5e4e37'); rect(13 * 16 - 9, 4 * 16 + 19, 3, 28, '#5e4e37')
    rect(15 * 16, 7 * 16 + 2, 17, 10, '#77633f'); rect(15 * 16 + 2, 7 * 16, 13, 3, '#a68a53'); rect(15 * 16 + 3, 7 * 16 + 12, 3, 3, '#aaa394'); rect(15 * 16 + 12, 7 * 16 + 12, 3, 3, '#aaa394')
    text('06 / ABANDONED SHAFT', 7 * 16, 3 * 16 - 4, '#7a8067')
  }
  for (const d of g.drops) if (g.seen[keyOf(d.x, d.y)]) { const x = d.x * 16 + 5, y = d.y * 16 + 7; rect(x + 2, y, 3, 2, ORE_COLORS[d.type]); rect(x, y + 2, 7, 3, ORE_COLORS[d.type]); rect(x + 2, y + 5, 3, 2, ORE_COLORS[d.type]); rect(x + 2, y + 1, 1, 2, '#fff2cf') }
  drawCrew(ctx, crew, cx, cy, width, height, g.time, settings.reduced)
  let frame = ({ idle: 0, starting: 1, stopping: 2, turning: 3, jumping: 6, falling: 7, landing: 9, crouching: 9, 'dig-side': 10, 'dig-up': 11, 'dig-down': 12, climbing: 14, celebrating: 15, tired: 16, carrying: 17, damage: 18, pushing: 19 })[p.state] ?? 0
  if (p.state === 'walking') frame = 1 + Math.floor(g.time * 12) % 4
  if (p.state.startsWith('dig') && Math.floor(g.time * 12) % 2) frame = 13
  if (p.state === 'climbing') frame = Math.floor(g.time * 8) % 2 ? 14 : 15
  const mx = Math.round((p.x + .325) * 16 - cx), my = Math.round((p.y + .9) * 16 - cy)
  ctx.save(); ctx.translate(mx, my); ctx.scale(p.facing, 1)
  ctx.drawImage(sprites(), frame * 16, 0, 16, 24, -8, -24, 16, 24)
  if (g.artifacts.some(a => a.outcome === 'cosmetic')) { ctx.fillStyle = '#98bf84'; ctx.fillRect(-1, -12, 7, 2) }
  const mining = p.state.startsWith('dig'), recoil = mining && g.time - g.lastHit < .12 ? -2 : 0
  ctx.fillStyle = TOOLS[g.tool].color
  const vertical = p.state === 'dig-up' || p.state === 'dig-down'
  if (TOOLS[g.tool].laser) {
    ctx.fillRect(5, -11, 8, 4); ctx.fillStyle = '#b6efbf'; ctx.fillRect(13, -10, 6, 1)
    if (p.state === 'carrying') ctx.fillRect(13, -10, 17, 1)
  } else if (TOOLS[g.tool].drill) {
    if (vertical) { ctx.fillRect(4, p.state === 'dig-up' ? -28 : -6, 4, 9); ctx.fillStyle = '#c3d3d1'; ctx.fillRect(5, p.state === 'dig-up' ? -31 : 3, 2, 3) }
    else { ctx.fillRect(5 + recoil, -10, 8, 4); ctx.fillStyle = g.cooldown ? '#ff796c' : '#b5bbb4'; ctx.fillRect(13 + recoil, -9, 3, 2) }
    if (g.tool === 6) { ['#c492f4', '#92efa0', '#79f3f2'].forEach((color, i) => { ctx.fillStyle = color; ctx.fillRect(6 + i * 2, -9, 2, 2) }) }
  } else if (vertical) {
    const y = p.state === 'dig-up' ? -28 : -4
    ctx.fillRect(4, y + recoil, 2, 9); ctx.fillRect(1, y + recoil, 9, 2)
  } else { ctx.fillRect(7 + recoil, -13 + recoil, 2, 11); ctx.fillRect(4 + recoil, -14 + recoil, 8, 2); ctx.fillRect(11 + recoil, -12 + recoil, 2, 3) }
  ctx.restore()
  if (g.impact?.until > g.time && !settings.reduced) { const a = g.impact; rect(a.x * 16 + 6, a.y * 16 + 3, 2, 9, '#fff2c6'); rect(a.x * 16 + 3, a.y * 16 + 6, 9, 2, '#fff2c6') }
  if (g.beam?.until > g.time) {
    const bx = g.beam.x * 16 + 8, by = g.beam.y * 16 + 8, sx = (p.x + .325) * 16, sy = p.y * 16 + 4
    for (let i = 0; i < 20; i++) rect(sx + (bx - sx) * i / 20, sy + (by - sy) * i / 20, 2, 1, i % 2 ? '#d9aae9' : '#b7edb3')
  }
  if (g.frog?.until > g.time) {
    const hop = settings.reduced ? 0 : Math.floor(g.time * 6) % 2 * 2, x = g.frog.x * 16, y = g.frog.y * 16 + 10 - hop
    rect(x + 3, y + 2, 10, 5, '#83a86b'); rect(x + 3, y, 3, 3, '#acd08a'); rect(x + 10, y, 3, 3, '#acd08a'); rect(x + 4, y, 1, 1, '#182318'); rect(x + 11, y, 1, 1, '#182318'); rect(x + 1, y + 6, 5, 2, '#64884f'); rect(x + 10, y + 6, 5, 2, '#64884f')
  }
  for (const a of g.particles) rect(a.x * 16, a.y * 16, 2, 2, a.color)
  if (g.target && g.seen[keyOf(g.target.x, g.target.y)]) {
    const info = targetInfo(g), x = g.target.x * 16, y = g.target.y * 16, color = settings.contrast ? '#ffffff' : info.locked ? '#d19075' : info.reachable ? '#f9d98d' : '#777d74'
    rect(x, y, 16, 1, color); rect(x, y + 15, 16, 1, color); rect(x, y, 1, 16, color); rect(x + 15, y, 1, 16, color)
    if (info.locked) { rect(x + 17, y + 1, 7, 1, color); rect(x + 17, y + 7, 7, 1, color); rect(x + 17, y + 1, 1, 7, color); rect(x + 23, y + 1, 1, 7, color); for (let i = 1; i < 6; i++) rect(x + 17 + i, y + 1 + i, 1, 1, color) }
    else { rect(x + 19, y + 3, 1, 6, TOOLS[g.tool].color); rect(x + 17, y + 2, 5, 1, TOOLS[g.tool].color) }
    const pos = playerTile(g)
    if (g.target.y > pos.y && Math.abs(g.target.x - pos.x) < 2) text(info.locked ? '! UNSAFE' : 'SAFE DROP', x - 12, y + 25, color)
  }
  if (g.escapeUntil > g.time) text('! MOVE AWAY !', p.x * 16 - 25, p.y * 16 - 26, '#ffb87b')
}

function drawCrew(ctx, crew, cx, cy, width, height, time, reduced) {
  if (!crew?.miners || crew.crewIntroduced === false) return
  const visible = [...crew.miners].sort((a, b) => Math.hypot(a.x - cx / 16, a.y - cy / 16) - Math.hypot(b.x - cx / 16, b.y - cy / 16))
  for (const miner of visible) {
    const mx = Math.round((miner.x + .325) * 16 - cx), my = Math.round((miner.y + .9) * 16 - cy)
    if (mx < -30 || mx > width + 30 || my < -60 || my > height + 30) continue
    const bob = reduced ? 0 : miner.state === 'walking' ? Math.floor((time + miner.index) * 8) % 2 : 0
    ctx.save()
    ctx.translate(mx, my - bob)
    ctx.scale(miner.facing || 1, 1)
    ctx.fillStyle = '#111714'
    ctx.fillRect(-7, -17, 14, 16)
    ctx.fillStyle = miner.color || '#c7bd9d'
    ctx.fillRect(-6, -14, 12, 8)
    ctx.fillStyle = '#1d221b'
    ctx.fillRect(-5, -7, 10, 8)
    ctx.fillStyle = miner.color || '#c7bd9d'
    ctx.fillRect(-6, -21, 12, 5)
    ctx.fillStyle = '#f3d68f'
    ctx.fillRect(2, -19, 3, 3)
    ctx.fillStyle = '#d4b16d'
    ctx.fillRect(-5, 1, 4, 3)
    ctx.fillRect(2, 1, 4, 3)
    ctx.fillStyle = miner.state === 'mining' ? '#fff1a4' : miner.color || '#c7bd9d'
    if (miner.tool?.includes('drill') || miner.tool?.includes('laser')) {
      ctx.fillRect(5, -12, 8, 3)
      ctx.fillRect(12, -11, 3, 2)
    } else {
      ctx.fillRect(5, -16, 2, 12)
      ctx.fillRect(2, -17, 8, 2)
    }
    if (miner.role === 'CHAOS MINER' && miner.state === 'mining') {
      ctx.fillStyle = '#ffbd5d'
      ctx.fillRect(10, -5, 2, 2)
      ctx.fillRect(14, -9, 1, 1)
    }
    ctx.restore()
  }
}
