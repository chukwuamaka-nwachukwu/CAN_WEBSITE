import { configureStore } from '@reduxjs/toolkit'

import authReducer from '../store/authSlice.js'
import uiReducer from '../store/uiSlice.js'

import { authApi } from '../features/auth/api.js'
import { vendorApi } from '../features/vendor/api.js'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,

    [authApi.reducerPath]:
      authApi.reducer,

    [vendorApi.reducerPath]:
      vendorApi.reducer,
  },

  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredPaths: ['auth'],
      },
    }).concat(
      authApi.middleware,
      vendorApi.middleware,
    ),
})

export const apiReducers = [
  authApi,
  vendorApi,
]