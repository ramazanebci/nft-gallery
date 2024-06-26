<template>
  <CollectionDropGenerativeLayout @mint="handleSubmitMint" />

  <CollectionDropModalPaidMint
    v-model="isMintModalActive"
    :action="action"
    :status="status"
    @confirm="handleConfirmPaidMint"
    @close="handleMintModalClose"
    @list="handleList" />
</template>

<script setup lang="ts">
import { useDrop, useDropStatus } from '@/components/drops/useDrops'
import { useUpdateMetadata } from '@/composables/drop/useGenerativeDropMint'
import type { AutoTeleportAction } from '@/composables/autoTeleport/types'
import { ActionlessInteraction } from '@/components/common/autoTeleport/utils'
import useCursorDropEvents from '@/composables/party/useCursorDropEvents'
import useDropMassMint from '@/composables/drop/massmint/useDropMassMint'
import useDropMassMintListing from '@/composables/drop/massmint/useDropMassMintListing'
import { NFTs } from '@/composables/transaction/types'

const { drop } = useDrop()
const { subscribeDropStatus } = useDropStatus(drop)
const instance = getCurrentInstance()
const { doAfterLogin } = useDoAfterlogin(instance)
const { $i18n, $consola } = useNuxtApp()
const { toast } = useToast()
const { isLogIn } = useAuth()
const { openListingCartModal } = useListingCartModal({
  clearItemsOnBeforeUnmount: true,
  clearItemsOnModalClose: true,
})

const {
  loading,
  walletConnecting,
  mintingSession,
  allocatedNFTs,
  isCapturingImage,
} = storeToRefs(useDropStore())

const {
  transaction,
  isLoading: isTransactionLoading,
  status,
  isError,
  txHash,
} = useTransaction({
  disableSuccessNotification: true,
})

useCursorDropEvents([isTransactionLoading, loading])

const isMintModalActive = ref(false)

const action = computed<AutoTeleportAction>(() => ({
  interaction: ActionlessInteraction.PAID_DROP,
  handler: () => mintNft(),
  details: {
    isLoading: isTransactionLoading.value,
    status: status.value,
    isError: isError.value,
  },
}))

const mintNft = async () => {
  try {
    loading.value = true
    mintingSession.value.txHash = undefined

    transaction({
      interaction: NFTs.MINT_DROP,
      collectionId: drop.value?.collection,
      nfts: allocatedNFTs.value,
      price: drop.value?.price || null,
    })
  } catch (e) {
    showNotification(`[MINT::ERR] ${e}`, notificationTypes.warn)
    $consola.error(e)
    isTransactionLoading.value = false
    loading.value = false
  }
}

const clearWalletConnecting = () => {
  walletConnecting.value = false
}

const handleSubmitMint = async () => {
  if (!isLogIn.value) {
    walletConnecting.value = true
    doAfterLogin({
      onLoginSuccess: clearWalletConnecting,
      onCancel: clearWalletConnecting,
    })

    return
  }
  if (loading.value || isCapturingImage.value) {
    return false
  }

  openMintModal()
  massGenerate()
}

const openMintModal = () => {
  isMintModalActive.value = true
}

const handleMintModalClose = () => {
  closeMintModal()
  clearMassMint()
}

const closeMintModal = () => {
  isMintModalActive.value = false
}

const submitMints = async () => {
  try {
    const { mintedNfts } = await useUpdateMetadata()
    mintingSession.value.items = mintedNfts.value

    subscribeForNftsWithMetadata(mintedNfts.value.map((item) => item.id))

    loading.value = false
  } catch (error) {
    toast($i18n.t('drops.mintDropError', [error?.toString()]))
    isCapturingImage.value = false
    closeMintModal()
    throw error
  }
}

const handleList = () => {
  closeMintModal()
  listMintedNFTs()
  openListingCartModal()
}

const handleConfirmPaidMint = () => {
  mintNft()
}

const stopMint = () => {
  isMintModalActive.value = false
  loading.value = false
  clearMassMint()
}

const { massGenerate, clearMassMint } = useDropMassMint()

const { subscribeForNftsWithMetadata, listMintedNFTs } =
  useDropMassMintListing()

useTransactionTracker({
  transaction: {
    isError,
    status,
  },
  onSuccess: submitMints,
  onCancel: stopMint,
  onError: () => {
    loading.value = false
  },
  // ensure txHash is set, it's needed when calling /do/:id
  waitFor: [computed(() => Boolean(mintingSession.value.txHash))],
})

watch(txHash, () => {
  mintingSession.value.txHash = txHash.value
})

onBeforeMount(subscribeDropStatus)
</script>

<style scoped lang="scss">
.order-1 {
  order: 1;
}
</style>
