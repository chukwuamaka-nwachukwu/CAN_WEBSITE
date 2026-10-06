import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'

import { store } from './app/store.js'
import { router } from './app/router.jsx'

import { ToastViewport } from './components/common/Toast.jsx'

export default function App() {
  return (
    <Provider store={store}>
      <RouterProvider
        router={router}
      />

      <ToastViewport />
    </Provider>
  )
}