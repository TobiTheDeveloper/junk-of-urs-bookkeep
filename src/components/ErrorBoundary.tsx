import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center px-4 py-8">
          <div className="w-full max-w-md rounded-2xl border border-red-900/50 bg-red-950/20 p-6 text-center">
            <h1 className="text-lg font-bold text-red-200">Something went wrong</h1>
            <p className="text-sm text-red-100/70 mt-2 leading-relaxed">
              The app hit an unexpected error. Try refreshing the page. If it keeps happening, sign
              out and sign back in.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-red-900/50 border border-red-800 px-4 py-2.5 text-sm font-semibold text-red-100 hover:bg-red-900/70"
            >
              Reload app
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
