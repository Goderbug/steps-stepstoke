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
          This page could not be rendered: {this.state.error.message}. Review the original transaction records before trying again. <a href="#/">Return home</a> and reload.
        </p>
      </main>
    );
  }
}
