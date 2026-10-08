export const minerals = {
  copper: { name: 'Copper', rarity: 'Uncommon', color: '#c97e4e', icon: '▰', min: 1, max: 5, description: 'Not valuable enough to retire. Valuable enough to keep digging.' },
  silver: { name: 'Silver', rarity: 'Rare', color: '#d9e8ee', icon: '◈', min: 5, max: 15, description: 'Shiny, suspicious, and probably hiding behind six more walls.' },
  gold: { name: 'Gold', rarity: 'Very rare', color: '#ffce55', icon: '▰', min: 15, max: 50, description: 'The miner has suddenly forgotten how tired he was.' },
  diamond: { name: 'Diamond', rarity: 'Extremely rare', color: '#7aeaff', icon: '◆', min: 50, max: 200, description: 'It was exactly one block away.' },
  sol: { name: 'SOL Crystal', rarity: 'Legendary', color: '#8affe0', icon: '⬡', min: 200, max: 1000, description: 'It looks expensive. It is not real money.' },
  unknown: { name: 'Unknown Mineral', rarity: 'Secret', color: '#f4b4ff', icon: '⟡', min: 1500, max: 2500, description: 'The scanner resigned. The rock has hired a lawyer.' },
}

export const tools = [
  { name: 'Rusty Pickaxe', depth: 0, mineral: null, power: 1, hint: 'Issued at the surface.' },
  { name: 'Reinforced Pickaxe', depth: 100, mineral: 'copper', power: 2, hint: 'Reach 100 m or discover copper.' },
  { name: 'Silver Drill', depth: 1000, mineral: 'silver', power: 3, hint: 'Reach 1 km or discover silver.' },
  { name: 'Golden Drill', depth: 10000, mineral: 'gold', power: 4, hint: 'Reach 10 km or discover gold.' },
  { name: 'Diamond-Tip Drill', depth: 50000, mineral: 'diamond', power: 5, hint: 'Reach 50 km or discover diamond.' },
  { name: 'Ancient Laser Cutter', depth: 100000, mineral: 'unknown', power: 6, hint: 'Reach 100 km or discover the unknown.' },
  { name: 'SOL-Powered Drill', depth: Infinity, mineral: 'sol', power: 7, hint: 'Discover a SOL Crystal.' },
]

export const readings = ['Weak metallic signal', 'Dense object detected', 'Heat source behind wall', 'Unknown energy pattern', 'Possible hollow chamber', 'Signal interference', 'Probably nothing', 'Definitely something', 'Scanner malfunction']

export const surprises = {
  empty: ['Empty chamber', 'Even the echo has left.'],
  spoon: ['False Shine', 'A spoon. Polished by generations of disappointment.'],
  tool: ['Broken mining tool', 'The warranty expired three civilizations ago.'],
  creature: ['Sleeping tenant', 'You woke the landlord. It wants five more centuries.'],
  gas: ['Gas pocket', 'That was not a treasure smell.'],
  lava: ['Lava leak', 'The wall has central heating.'],
  rocks: ['Falling rocks', 'The ceiling would like a word.'],
  mimic: ['Mimic Deposit', 'Your retirement fund grew legs and ran away.'],
}

export const events = ['Gold Rush', 'Diamond Echo', 'Crystal Storm', 'Motherlode', 'Miner’s Luck', 'Fool’s Gold Room']
