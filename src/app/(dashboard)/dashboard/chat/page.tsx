import ChatWorkspace from "@/components/dashboard/chat/ChatWorkspace";

/**
 * Messages.
 *
 * Three ways in, all of them this page:
 *
 *   ?offer=<id>    the farmer pressed Chat on an offer they received
 *   ?listing=<id>  the factory pressed Chat on a harvest in the marketplace
 *   ?c=<id>        a thread opened from the list, or a refresh of one
 *
 * The first two name a trade rather than a conversation, because neither the
 * offers inbox nor the marketplace knows whether the two sides have spoken
 * before. The workspace resolves them and rewrites the URL to the third form.
 */

export const metadata = {
  title: "Messages · CeylonGuard",
};

type Props = {
  searchParams: Promise<{ offer?: string; listing?: string; c?: string }>;
};

const ChatPage = async ({ searchParams }: Props) => {
  const { offer, listing, c } = await searchParams;

  return (
    <ChatWorkspace
      {...(offer ? { offerId: offer } : {})}
      {...(listing ? { listingId: listing } : {})}
      {...(c ? { conversationId: c } : {})}
    />
  );
};

export default ChatPage;
