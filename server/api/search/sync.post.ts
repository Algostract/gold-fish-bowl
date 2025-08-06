export interface TypesenseModel extends Omit<Model, 'url' | 'isFavorite' | 'photo'> {
  status: string
  'photo.title': string
  'photo.image'?: string
  'photo.description': string
  'photo.aspectRatio': number
}

export async function syncSearchDb() {
  const config = useRuntimeConfig()
  const notionDbId = config.private.notionDbId as unknown as NotionDB

  const models = await notionQueryDb<NotionModel>(notion, notionDbId.model)

  const documents = models
    .map(({ cover, properties }): TypesenseModel | null => {
      const title = notionTextStringify(properties.Name.title)

      if (!(properties.Latitude.number && properties.Longitude.number)) return null

      return {
        id: properties.Slug.formula.string,
        name: title,
        status: properties.Status.status.name,
        fee: properties.Fee.number,
        'photo.title': title,
        'photo.image': cover?.type === 'external' ? cover.external.url.split('/')[3] : undefined,
        'photo.description': '',
        'photo.aspectRatio': 16 / 9,
        rating: 0,
        reviewCount: 0,
        coordinate: [properties.Longitude.number, properties.Latitude.number],
        isFeatured: false,
      }
    })
    .filter((item) => item !== null)

  try {
    // Upsert documents (update if exists, create if not)
    await typesense.collections('model').documents().import(documents, { action: 'upsert' })
  } catch (error) {
    console.error('Upsert error', error.importResults)
    throw error
  }
}

export default defineEventHandler(async () => {
  await syncSearchDb()
  return { result: 'success' }
})
