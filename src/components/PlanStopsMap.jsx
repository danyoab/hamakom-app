// Compatibility wrapper: all plan surfaces now use the same truthful map.
import PlanRouteMap from './PlanRouteMap.jsx'

export default function PlanStopsMap(props) {
  if (!props.stops?.length) return null
  return <div style={{ borderRadius: 16, overflow: 'hidden', height: 320, marginBottom: 14 }}><PlanRouteMap {...props} /></div>
}
