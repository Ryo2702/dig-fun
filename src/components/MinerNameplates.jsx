import { forwardRef, useImperativeHandle, useRef } from 'react'

const shortStatus = value => String(value || 'Searching for ore').replace(/[.!…]+$/, '').slice(0, 30)
const plateWidth = (name, status) => Math.min(190, Math.max(54, Math.max(name.length * 8, status.length * 5.4) + 14))

const screenPosition = (x, y, camera, canvas, scale) => {
  const zoom = camera.zoom || 1
  const localX = (x * 16 - (camera.drawX ?? camera.x)) * zoom + canvas.width / 2 * (1 - zoom)
  const localY = (y * 16 - (camera.drawY ?? camera.y)) * zoom + canvas.height / 2 * (1 - zoom)
  return { x: Math.round(localX * scale), y: Math.round(localY * scale) }
}

const MinerNameplates = forwardRef(function MinerNameplates({ miners = [], crewVisible = true, followId = 'player', focusId, onMinerClick }, ref) {
  const layer = useRef(null)
  useImperativeHandle(ref, () => ({
    update({ game, autonomy, camera, canvas, container, scale, followId: currentFollowId = followId, focusId: currentFocusId = focusId }) {
      const root = layer.current
      if (!root || !canvas || !container || !scale) return
      const canvasRect = canvas.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const originX = Math.round(canvasRect.left - containerRect.left)
      const originY = Math.round(canvasRect.top - containerRect.top)
      const entries = [
        { id: 'player', name: 'YOU', color: '#ffd36a', status: autonomy?.status || 'Searching for ore', x: game.player.x + .325, y: game.player.y + .9 },
        ...miners.map(miner => ({ id: miner.id, name: miner.name, color: miner.color, status: miner.status || miner.speech || miner.goal, x: miner.x + .325, y: miner.y + .9 })),
      ]
      const nodes = new Map([...root.children].map(node => [node.dataset.minerId, node]))
      const visibleIds = new Set([currentFollowId, currentFocusId].filter(Boolean))
      const placed = []
      for (const entry of entries) {
        const node = nodes.get(entry.id)
        if (!node) continue
        const status = shortStatus(entry.status)
        const width = plateWidth(entry.name, status)
        const position = screenPosition(entry.x, entry.y, camera, canvas, scale)
        const screenX = originX + position.x
        const screenY = originY + position.y
        const forced = entry.id === currentFollowId || entry.id === currentFocusId
        const isNearby = screenX >= -width && screenX <= containerRect.width + width && screenY >= -40 && screenY <= containerRect.height + 20
        const overlaps = placed.some(item => Math.abs(item.x - screenX) < (item.width + width) / 2 && Math.abs(item.y - screenY) < 30)
        const show = crewVisible && isNearby && visibleIds.has(entry.id) && (!overlaps || entry.id === currentFollowId)
        node.hidden = !show
        node.style.left = `${Math.round(screenX - width / 2)}px`
        node.style.top = `${Math.round(screenY - 35)}px`
        node.style.width = `${width}px`
        node.style.setProperty('--name-color', entry.color || '#d9d3b2')
        node.querySelector('[data-name]').textContent = entry.name.toUpperCase()
        node.querySelector('[data-status]').textContent = status
        if (show) placed.push({ x: screenX, y: screenY, width })
      }
      const group = root.querySelector('[data-group]')
      const nearby = miners.filter(miner => Math.hypot(miner.x - game.player.x, miner.y - game.player.y) < 1.5)
      if (group) {
        group.hidden = nearby.length < 2 || nearby.some(miner => visibleIds.has(miner.id))
        if (!group.hidden) {
          const first = nearby[0]
          const position = screenPosition(first.x + .325, first.y + .9, camera, canvas, scale)
          group.style.left = `${Math.round(originX + position.x - 40)}px`
          group.style.top = `${Math.round(originY + position.y - 28)}px`
          group.textContent = `${nearby.length} MINERS HERE`
        }
      }
    },
  }), [crewVisible, miners, followId, focusId])

  return <div ref={layer} className="miner-nameplates" aria-label="Miner names">
    <div className="miner-nameplate miner-nameplate--player" data-miner-id="player"><b data-name="">YOU</b><span data-status="">Searching for ore</span></div>
    {miners.map(miner => <button type="button" className="miner-nameplate miner-nameplate--npc" data-miner-id={miner.id} key={miner.id} onClick={() => onMinerClick?.(miner.id)}><b data-name="">{miner.name.toUpperCase()}</b><span data-status="">{shortStatus(miner.status || miner.speech || miner.goal)}</span></button>)}
    <div className="miner-group-indicator" data-group hidden />
  </div>
})

export default MinerNameplates
