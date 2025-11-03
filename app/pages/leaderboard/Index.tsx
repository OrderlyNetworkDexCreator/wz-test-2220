import { LeaderboardPage } from "@orderly.network/trading-leaderboard";
import { generatePageTitle } from "@/utils/utils";
import { getPageMeta } from "@/utils/seo";
import { renderSEOTags } from "@/utils/seo-tags";
import { useState } from "react";

export default function LeaderboardIndex() {
  const pageMeta = getPageMeta();
  const pageTitle = generatePageTitle("Leaderboard");
  const [campaignId, setCampaignId] = useState("128");

  return (
    <>
      {renderSEOTags(pageMeta, pageTitle)}
      <div className="oui-py-6 oui-px-4 lg:oui-px-6 xl:oui-pl-4 lx:oui-pr-6">
        <LeaderboardPage
          campaigns={campaigns}
          campaignId={campaignId}
          onCampaignChange={(id) => setCampaignId(String(id))}
          backgroundSrc="/logo"
        />
      </div>
    </>
  );
}

const campaigns = [
  {
    campaign_id: "25",
    title: "PURPSTV Trading Campaign Vol-1",
    description: "A new era begins. PURPSTV is here.",
    image: "/logo.webp",
    start_time: new Date("2025-10-25T00:00:00Z").toISOString(),
    end_time: new Date("2025-11-24T23:59:59Z").toISOString(),
    href: "/",
    emphasisConfig: {
      hideConnectWallet: true,
      subtitle: "Brings out the best of you",
      walletConnect: {
        title: "Connect Wallet",
        description: "Description text"
      }
    },
    prize_pools: [
      {
        pool_id: "trading1",
        label: "Trading volume",
        total_prize: 20000,
        currency: "USDC",
        metric: "volume" as const,
        tiers: [
          { position: 1, amount: 1400 },
          { position: 2, amount: 1200 },
          { position_range: [4, 5] as [number, number], amount: 750 }
        ]
      }
    ]
  }
];