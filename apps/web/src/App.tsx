import { CORE_PACKAGE_NAME } from '@repo/core'
import { UI_PACKAGE_NAME } from '@repo/ui'

function App() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-900">
      <h1 className="text-2xl font-bold">Prestly</h1>
      <p className="text-sm text-slate-500">
        apps/web listo · {CORE_PACKAGE_NAME} + {UI_PACKAGE_NAME} enlazados
      </p>
    </main>
  )
}

export default App
