import { Component, type ReactNode } from "react";

/** Keeps a rendering failure from blanking the site; the message says what to do next. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page">
        <p className="alert alert-error" role="alert">
          页面出现错误：{this.state.error.message}。没有发送任何交易。<a href="#/">返回首页</a>后重新加载。
        </p>
      </main>
    );
  }
}
