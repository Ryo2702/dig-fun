import { motion } from 'motion/react'

export default function PixelButton({ children, className = '', variant = 'gold', ...props }) {
  return (
    <motion.button
      className={`pixel-button pixel-button--${variant} ${className}`}
      whileHover={{ y: -2 }}
      whileTap={{ y: 2, scale: 0.98 }}
      transition={{ duration: 0.12 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
