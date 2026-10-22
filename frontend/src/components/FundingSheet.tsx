import type { ComponentProps } from "react";
import { SponsorPanel } from "../ui/SponsorPanel";
import { Sheet } from "./Sheet";
export function FundingSheet({ onClose, returnFocusTo, ...props }: ComponentProps<typeof SponsorPanel> & { onClose: () => void; returnFocusTo?: HTMLElement | null }) {
  return <Sheet title={props.retryOf ? "Review identical paid retry" : "Fund a contribution"} onClose={onClose} returnFocusTo={returnFocusTo}><SponsorPanel {...props} /></Sheet>;
}
