import type { ComponentProps } from "react";
import { SponsorPanel } from "../ui/SponsorPanel";
import { Sheet } from "./Sheet";
export function FundingSheet({ onClose, ...props }: ComponentProps<typeof SponsorPanel> & { onClose: () => void }) {
  return <Sheet title={props.retryOf ? "Review identical paid retry" : "Fund a contribution"} onClose={onClose}><SponsorPanel {...props} /></Sheet>;
}
