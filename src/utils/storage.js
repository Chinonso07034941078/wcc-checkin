const KEY = 'wcc2026-checkins-v1'
export function getCheckins(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
export function saveCheckins(items){localStorage.setItem(KEY,JSON.stringify(items))}
export function clearCheckins(){localStorage.removeItem(KEY)}
