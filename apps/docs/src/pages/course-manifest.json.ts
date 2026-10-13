import { learningPages, sitePages } from '../data/course'

export const prerender = true
export function GET() {
  return new Response(JSON.stringify({ pages: sitePages, lessons: learningPages }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } })
}
