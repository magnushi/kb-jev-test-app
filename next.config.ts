import type {NextConfig} from 'next'
const config: NextConfig = {
  // linkedom and the Anthropic SDK are server-only; never bundle them client-side.
  serverExternalPackages: ['linkedom', '@mozilla/readability'],
}
export default config
