import { MassMintNFT } from './useDropMassMint'
import useGenerativeIframeData, {
  ImageDataPayload,
} from '../useGenerativeIframeData'
import { createUnlockableMetadata } from '@/components/collection/unlockable/utils'
import { useCollectionEntity } from '../useGenerativeDropMint'
import useDropMassMintState from './useDropMassMintState'

const MAX_RENDER_AT_ONCE_AMOUNT = 3

export default () => {
  const { accountId } = useAuth()
  const dropStore = useDropStore()
  const { toMintNFTs, drop, mintingSession } = storeToRefs(dropStore)
  const { isRendering, renderingNFTsCount, toRenderNFTsCount } =
    useDropMassMintState()
  const { description, collectionName } = useCollectionEntity()

  const payloads = ref(new Map<string, ImageDataPayload>())

  const allPinned = computed(
    () =>
      toMintNFTs.value.length !== 0 &&
      toMintNFTs.value.map((item) => item.metadata).every(Boolean),
  )

  const onMessage = (payload: ImageDataPayload) => {
    // always keep track of incomming payloads
    payloads.value.set(payload.hash, payload)

    const mintHasntStarted = !toMintNFTs.value.length
    const mintHasEnded = mintingSession.value.items.length

    if (mintHasntStarted || mintHasEnded) {
      return
    }

    if (payload.image === 'data:,') {
      return regenerateNfTWithHash(payload.hash)
    }

    console.log('[MASSMINT::PREVIEW] Successfully generated ', payload.hash)

    handleNewImageDataPayload(payload)
  }

  useGenerativeIframeData({
    onMessage,
  })

  const handleNewImageDataPayload = (payload: ImageDataPayload) => {
    toMintNFTs.value = toMintNFTs.value.map((toMintNft) =>
      toMintNft.hash === payload.hash
        ? { ...toMintNft, imageDataPayload: payload }
        : toMintNft,
    )
  }

  const regenerateNfTWithHash = (hash: string) => {
    toMintNFTs.value = toMintNFTs.value.map((item) => {
      if (item.hash === hash) {
        console.log(
          '[MASSMINT::PREVIEW] Regenerating nft with range ',
          item.entropyRange,
        )
        return {
          ...item,
          ...generatePreviewItem({
            entropyRange: item.entropyRange,
            accountId: accountId.value,
            content: drop.value.content,
          }),
        }
      }
      return item
    })
  }

  const pinMetadata = (item: MassMintNFT): Promise<string> => {
    return new Promise((resolve, reject) => {
      const image = item.image
      tryCapture({
        image,
        data: item.imageDataPayload as ImageDataPayload,
      })
        .then((imageCid) =>
          createUnlockableMetadata(
            imageCid,
            description.value || '',
            (collectionName.value || drop.value.name) ?? '',
            'text/html',
            image,
          ),
        )
        .then(resolve)
        .catch(reject)
    })
  }

  const getPreviewItemsToMintedNfts = (
    previewItems: GenerativePreviewItem[],
  ) => {
    return previewItems.map((item) => {
      return {
        name: drop.value.name,
        collectionName: collectionName.value as string,
        image: item.image,
        price: drop.value.price as string,
        hash: item.hash,
        entropyRange: item.entropyRange,
        canRender: false,
      }
    })
  }

  watch(
    [renderingNFTsCount, toRenderNFTsCount],
    ([renderingCount, toRenderCount]) => {
      if (
        isRendering.value &&
        Boolean(toRenderCount) &&
        renderingCount < MAX_RENDER_AT_ONCE_AMOUNT
      ) {
        const toRenderMintNFT = toMintNFTs.value.find(
          (nft) => !nft.imageDataPayload && !nft.canRender,
        )

        if (!toRenderMintNFT) {
          return
        }

        console.log(
          '[MASSMINT::PREVIEW] Starting to render',
          toRenderMintNFT.hash,
        )

        toMintNFTs.value = toMintNFTs.value.map((toMintNFT) =>
          toMintNFT.hash === toRenderMintNFT.hash
            ? { ...toRenderMintNFT, canRender: true }
            : toMintNFT,
        )
      }
    },
  )

  return {
    getPreviewItemsToMintedNfts,
    allPinned,
    payloads,
    pinMetadata,
  }
}
