/**
 * Central API base query.
 * - If VITE_API_URL is configured it talks to the real backend via fetch.
 * - Otherwise it routes to the bundled mock dispatcher so the entire UI can be
 *   developed without a server and swapped later without rewriting components.
 * Authentication tokens and tenant context are attached centrally here.
 */
import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { resolveRequest } from './mock/server.js'
import { logout, setToken, setCurrentUser, setCurrentVendor } from '../store/authSlice.js'
import { pushToast } from '../store/uiSlice.js'

const API_URL = import.meta.env.VITE_API_URL || ''
const USE_MOCK = !API_URL

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function tokenFrom(state) {
  if (!state?.auth) return null
  return state.auth.accessToken && state.auth.accessToken !== 'null' ? state.auth.accessToken : null
}

function refreshTokenFrom(state) {
  if (!state?.auth) return null
  return state.auth.refreshToken && state.auth.refreshToken !== 'null' ? state.auth.refreshToken : null
}

function buildParamsString(params) {
  if (!params) return ''
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) value.forEach((v) => qs.append(key, v))
    else qs.append(key, String(value))
  })
  const s = qs.toString()
  return s ? `?${s}` : ''
}

async function mockQuery(args, api) {
  const { url, method = 'GET', body, params } = args
  await delay(120 + Math.random() * 160)
  const state = api.getState()
  const headers = { authorization: tokenFrom(state) ? `Bearer ${tokenFrom(state)}` : '' }
  try {
    const result = resolveRequest(method, `${url}${buildParamsString(params)}`, body, headers)
    return { data: result.data }
  } catch (err) {
    const status = err.status || 500
    if (status === 401) {
      const refresh = refreshTokenFrom(state)
      if (refresh) {
        try {
          const refreshed = resolveRequest('POST', '/auth/refresh', { refreshToken: refresh }, {})
          api.dispatch(setToken(refreshed.data.accessToken))
          api.dispatch(setCurrentUser(refreshed.data.user))
          if (refreshed.data.vendor) api.dispatch(setCurrentVendor(refreshed.data.vendor))
          const retry = resolveRequest(method, `${url}${buildParamsString(params)}`, body, {
            authorization: `Bearer ${refreshed.data.accessToken}`,
          })
          return { data: retry.data }
        } catch {
          api.dispatch(logout())
        }
      } else {
        api.dispatch(logout())
      }
    }
    return { error: { status, data: { message: err.message } } }
  }
}

const realBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = tokenFrom(getState())
    if (token) headers.set('authorization', `Bearer ${token}`)
    return headers
  },
})

async function realQueryWithRefresh(args, api, extraOptions) {
  let result = await realBaseQuery(args, api, extraOptions)
  if (result.error && (result.error.status === 401 || result.error.status === 'PARSING_ERROR')) {
    const refresh = refreshTokenFrom(api.getState())
    if (refresh) {
      const refreshResult = await realBaseQuery(
        { url: '/auth/refresh', method: 'POST', body: { refreshToken: refresh } },
        api,
        extraOptions
      )
      if (refreshResult.data) {
        api.dispatch(setToken(refreshResult.data.accessToken))
        if (refreshResult.data.user) api.dispatch(setCurrentUser(refreshResult.data.user))
        if (refreshResult.data.vendor) api.dispatch(setCurrentVendor(refreshResult.data.vendor))
        result = await realBaseQuery(args, api, extraOptions)
      } else {
        api.dispatch(logout())
      }
    } else {
      api.dispatch(logout())
    }
  }
  return result
}

export async function baseQuery(args, api, extraOptions) {
  if (USE_MOCK) return mockQuery(args, api)
  return realQueryWithRefresh(args, api, extraOptions)
}

export function conditionalToast(api, message, type = 'success') {
  api.dispatch(
    pushToast({
      type,
      title: type === 'success' ? 'Success' : 'Error',
      message,
    })
  )
}