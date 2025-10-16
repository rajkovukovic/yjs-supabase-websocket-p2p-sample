import * as Y from 'yjs'
import { z } from 'zod'

// ====================================================================================
// Yjs-compatible Zod Schemas
// ====================================================================================

/**
 * zod schema for a Y.Text instance.
 * a Y.Text instance can be represented as a string.
 */
export const yTextSchema = z.string().transform((str) => new Y.Text(str))

/**
 * zod schema for a Y.Array instance.
 * a Y.Array instance can be represented as an array of items.
 *
 * @param itemSchema The schema for the items in the array.
 * @returns A Zod schema that transforms a JavaScript array into a Y.Array.
 */
export const yArraySchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.array(itemSchema).transform((arr) => Y.Array.from(arr))

/**
 * zod schema for a Y.Map instance.
 * a Y.Map instance can be represented as a map/object.
 *
 * @param valueSchema The schema for the values in the map.
 * @returns A Zod schema that transforms a JavaScript object into a Y.Map.
 */
export const yMapSchema = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.record(z.string(), valueSchema).transform((obj) => {
    const yMap = new Y.Map()
    for (const [key, value] of Object.entries(obj)) {
      yMap.set(key, value)
    }
    return yMap
  })

// ====================================================================================
// Drawable Schemas (Polymorphic)
// ====================================================================================

export const rectangleSchema = z.object({
  type: z.literal('rectangle'),
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  fill: z.string(),
})
export type Rectangle = z.infer<typeof rectangleSchema>

export const ellipseSchema = z.object({
  type: z.literal('ellipse'),
  id: z.string(),
  x: z.number(),
  y: z.number(),
  radiusX: z.number(),
  radiusY: z.number(),
  fill: z.string(),
})
export type Ellipse = z.infer<typeof ellipseSchema>

export const drawableSchema = z.discriminatedUnion('type', [
  rectangleSchema,
  ellipseSchema,
])
export type Drawable = z.infer<typeof drawableSchema>

// ====================================================================================
// Entity Schemas
// ====================================================================================

export const commentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  text: z.string(),
  timestamp: z.string().datetime(),
})

export const documentSchema = z.object({
  name: yTextSchema,
  drawables: yArraySchema(yMapSchema(drawableSchema)),
  comments: yArraySchema(yMapSchema(commentSchema)),
})
export type Document = z.infer<typeof documentSchema>

// ====================================================================================
// Entity Configuration
// ====================================================================================

export const entityConfigs = {
  document: {
    schema: documentSchema,
    tableName: 'documents',
    /**
     * Builder function to initialize the Yjs document structure for a 'document' entity.
     * @param doc The Y.Doc instance to populate.
     */
    yjsBuilder: (doc: Y.Doc) => {
      doc.get('name', Y.Text)
      doc.get('drawables', Y.Array)
      doc.get('comments', Y.Array)
    },
  },
  // Example for another entity type
  // userProfile: {
  //   schema: userProfileSchema,
  //   tableName: 'user_profiles',
  //   yjsBuilder: (doc: Y.Doc) => {
  //     doc.get('username', Y.Text);
  //     doc.get('bio', Y.Text);
  //   },
  // },
} as const

export type EntityType = keyof typeof entityConfigs

// ====================================================================================
// Schema Testing (for validation purposes)
// ====================================================================================

const testSchemas = () => {
  console.log('Running schema tests...')

  // Test Rectangle
  const validRectangle: Rectangle = {
    type: 'rectangle',
    id: 'rect1',
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    fill: '#ff0000',
  }
  try {
    rectangleSchema.parse(validRectangle)
    console.log('✅ Rectangle schema test passed')
  } catch (e) {
    console.error('❌ Rectangle schema test failed', e)
  }

  // Test Ellipse
  const validEllipse: Ellipse = {
    type: 'ellipse',
    id: 'ellipse1',
    x: 150,
    y: 100,
    radiusX: 50,
    radiusY: 30,
    fill: '#0000ff',
  }
  try {
    ellipseSchema.parse(validEllipse)
    console.log('✅ Ellipse schema test passed')
  } catch (e) {
    console.error('❌ Ellipse schema test failed', e)
  }

  // Test Polymorphic Drawable
  const drawables: Drawable[] = [validRectangle, validEllipse]
  try {
    z.array(drawableSchema).parse(drawables)
    console.log('✅ Polymorphic drawable schema test passed')
  } catch (e) {
    console.error('❌ Polymorphic drawable schema test failed', e)
  }

  // Test Document with Yjs transformations
  const documentData = {
    name: 'My Document',
    drawables: [
      {
        rect1: {
          type: 'rectangle',
          id: 'rect1',
          x: 10,
          y: 20,
          width: 100,
          height: 50,
          fill: 'red',
        },
      },
    ],
    comments: [
      {
        comment1: {
          id: 'c1',
          userId: 'user1',
          text: 'This is a comment',
          timestamp: new Date().toISOString(),
        },
      },
    ],
  }

  try {
    const parsedDoc = documentSchema.parse(documentData)
    if (
      parsedDoc.name instanceof Y.Text &&
      parsedDoc.drawables instanceof Y.Array &&
      parsedDoc.comments instanceof Y.Array &&
      parsedDoc.drawables.get(0) instanceof Y.Map
    ) {
      console.log('✅ Document schema with Yjs transforms test passed')
    } else {
      throw new Error('Yjs types not correctly transformed.')
    }
  } catch (e) {
    console.error('❌ Document schema with Yjs transforms test failed', e)
  }

  console.log('Schema tests completed.')
}

// Uncomment to run tests when this module is loaded
// testSchemas();
