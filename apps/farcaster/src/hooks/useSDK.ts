import { sdk } from '@farcaster/frame-sdk';

export function useSDK() {
  return {
    sdk,
    isInMiniApp: () => sdk.isInMiniApp(),
    getContext: () => sdk.context,
    quickAuth: {
      getToken: () => sdk.quickAuth.getToken(),
      fetch: (url: string, options?: RequestInit) => sdk.quickAuth.fetch(url, options),
    },
    actions: {
      ready: () => sdk.actions.ready(),
      openUrl: (url: string) => sdk.actions.openUrl(url),
      composeCast: (params: any) => sdk.actions.composeCast(params),
      viewProfile: (params: { fid: number }) => sdk.actions.viewProfile(params),
      addMiniApp: () => sdk.actions.addMiniApp(),
    },
    wallet: {
      getEthereumProvider: () => sdk.wallet.getEthereumProvider(),
      getSolanaProvider: () => sdk.wallet.getSolanaProvider(),
    },
  };
}