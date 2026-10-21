import { useLayoutEffect, useRef } from "react";

/** Carries cancellation through delayed adapter preparation to the final wallet boundary. */
export function useActionScope(identity = "") {
  const ref = useRef({ identity, active: true });
  if (ref.current.identity !== identity) {
    ref.current.active = false;
    ref.current = { identity, active: true };
  }
  const scope = ref.current;
  useLayoutEffect(() => {
    scope.active = true;
    return () => { scope.active = false; };
  }, [scope]);
  return () => {
    if (!scope.active) throw new Error("Preparation cancelled. Review again for the current account, network and page.");
  };
}
