import type { ExpressionSpecification } from 'maplibre-gl'
import { sequentialBlue } from './palette'

/** Sequential choropleth fill: one hue, light->dark, by the given property -
 *  never a rainbow, never a hue at a "midpoint" (this isn't diverging data). */
export function coverageFillExpression(property: string): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['coalesce', ['get', property], 0],
    0, sequentialBlue[100],
    20, sequentialBlue[250],
    40, sequentialBlue[350],
    60, sequentialBlue[450],
    80, sequentialBlue[550],
    100, sequentialBlue[700],
  ] as ExpressionSpecification
}
