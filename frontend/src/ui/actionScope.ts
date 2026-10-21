import { useEffect, useRef } from "react";

/** A delayed read may finish after its form/wallet has gone away. Never start a signature then. */
export function useActionScope() {
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  return () => {
    if (!active.current) throw new Error("账户、网络或页面已变更，请重新预览操作");
  };
}
