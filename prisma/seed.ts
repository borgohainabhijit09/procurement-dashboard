import { PrismaClient } from '@prisma/client'
import * as xlsx from 'xlsx'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Actually standard initialization:
// const prisma = new PrismaClient()

async function main() {
  const pClient = new PrismaClient()
  const filePath = path.join(__dirname, '../../assetorder_master.xlsx')
  const workbook = xlsx.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const data = xlsx.utils.sheet_to_json(sheet)
  
  for (const row of data as any[]) {
    // Handle the keys keeping track of the extra spaces from Excel
    await pClient.assetOrder.upsert({
      where: { id: row['ID '] },
      update: {},
      create: {
        id: row['ID '],
        bundle: row[' Bundle '] ? Number(row[' Bundle ']) : null,
        region: row[' Region '],
        country: row[' Country '],
        model: row[' Model '],
        quantity: Number(row[' Quantity ']) || 0,
        inProgress: Number(row[' InProgress ']) || 0,
        ordered: Number(row[' Ordered ']) || 0,
        inTransit: Number(row[' InTransit ']) || 0,
        delivered: Number(row[' Delivered ']) || 0,
        toBeOrdered: Number(row[' ToBeOrdered ']) || 0,
        status: row[' Status '] || null,
        lastUpdatedBy: row[' LastUpdatedBy '] || null,
        lastUpdatedOn: row[' LastUpdatedOn '] ? new Date(row[' LastUpdatedOn ']) : new Date(),
      }
    })
  }
  
  console.log('Seeding finished.')
  await pClient.$disconnect()
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
