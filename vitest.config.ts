import path from 'node:path'

export default {
  resolve: {
    alias: {
      '@root': path.resolve(__dirname, 'src'),
    },
  },
}
