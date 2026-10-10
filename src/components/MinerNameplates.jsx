import { forwardRef, useImperativeHandle, useRef } from 'react'

const shortStatus = value => String(value || 'Searching for ore').replace(/[.!…]+$/, '').slice(0, 30)
const plateWidth = (name, status) => Math.min(190, Math.max(54, Math.max(name.length * 8, status.length * 5.4) + 14))

const MinerNameplates = forwardRef(function MinerNameplates({ miners = [], crewVisible = true, onMinerClick }, ref) {
  const layer = useRef(null)
  useImperativeHandle(ref, () => ({
    update({ game, autonomy, camera, canvas, container, scale }) {
      const root = layer.current
      if (!root || !canvas || !container || !scale) return
      const canvasRect = canvas.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const originX = Math.round(canvasRect.left - containerRect.left)
      const originY = Math.round(canvasRect.top - containerRect.top)
      const entries = [
        { id: 'player', name: 'YOU', color: '#ffd36a', status: autonomy?.status || 'Searching for ore', visible: true, x: game.player.x + .325, y: game.player.y + .9 },
        ...miners.map(miner => ({ id: miner.id, name: miner.name, color: miner.color, status: miner.status || miner.speech || miner.goal, visible: crewVisible, x: miner.x + .325, y: miner.y + .9 })),
      ]
      const nodes = new Map([...root.children].map(node => [node.dataset.minerId, node]))
      for (const entry of entries) {
        const node = nodes.get(entry.id)
        if (!node) continue
        const status = shortStatus(entry.status)
        const width = plateWidth(entry.name, status)
        const screenX = originX + (entry.x * 16 - camera.drawX) * scale
        const screenY = originY + (entry.y * 16 - camera.drawY) * scale
        const left = Math.round(screenX - width / 2)
        const top = Math.round(screenY - 33)
        node.hidden = !entry.visible || screenX < -width || screenX > containerRect.width + width || screenY < -40 || screenY > containerRect.height + 20
        node.style.left = `${left}px`
        node.style.top = `${top}px`
        node.style.width = `${width}px`
        node.style.setProperty('--name-color', entry.color || '#d9d3b2')
        node.querySelector('[data-name]').textContent = entry.name.toUpperCase()
        node.querySelector('[data-status]').textContent = status
      }
    },
  }), [crewVisible, miners, onMinerClick])

  return <div ref={layer} className="miner-nameplates" aria-label="Miner names">
    <div className="miner-nameplate miner-nameplate--player" data-miner-id="player">
      <b data-name="">YOU</b><span data-status="">Searching for ore</span>
    </div>
    {miners.map(miner => <button type="button" className="miner-nameplate miner-nameplate--npc" data-miner-id={miner.id} key={miner.id} onClick={() => onMinerClick?.(miner.id)}>
      <b data-name="">{miner.name.toUpperCase()}</b><span data-status="">{shortStatus(miner.status || miner.speech || miner.goal)}</span>
    </button>)}
  </div>
})

export default MinerNameplates
