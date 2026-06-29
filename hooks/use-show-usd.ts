'use client'

import { useState, useEffect } from 'react'

const KEY = 'flowstar-show-usd'

export function useShowUsd(): [boolean, (v: boolean) => void] {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(KEY)
    if (stored !== null) setShow(stored !== 'false')
  }, [])

  function toggle(v: boolean) {
    setShow(v)
    localStorage.setItem(KEY, String(v))
  }

  return [show, toggle]
}
