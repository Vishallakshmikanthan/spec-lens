/**
 * Speclens Development Seed Data
 *
 * Populates the PostgreSQL database with realistic development data for
 * testing multi-user, multi-workspace scenarios.
 *
 * ALL DATA IS DEVELOPMENT/DEMO ONLY. Do not use in production.
 * 
 * Run: npx ts-node database/seed.ts
 * 
 * Seed data explicitly marks all entities with workspace ownership
 * to test the multi-tenancy layer. No real user data is used.
 */

import { db } from "@/lib/db"
import {
  users,
  workspaces,
  workspaceMembers,
  datasheets,
  datasheetPages,
  evidence,
  components,
  componentRelationships,
  collections,
  collectionItems,
  processingJobs,
  processingStages,
  searchHistory,
  activityEvents,
  notifications,
  copilotConversations,
  copilotMessages,
  symbols,
  symbolPins,
  documentEmbeddings,
  evidenceEmbeddings,
} from "@/database/schema"
import { sql } from "drizzle-orm"

// ============================================================
// Development seed data
// ============================================================

const USERS_COUNT = 3
const WORKSPACES_COUNT = 3
const DATASHEETS_PER_WORKSPACE = 4
const EVIDENCES_PER_DATASHEET = 6
const COMPONENTS_PER_WORKSPACE = 2
const COLLECTIONS_PER_WORKSPACE = 2
const PROCESSING_JOBS_PER_WORKSPACE = 3

// User data - development only
const userData = [
  {
    name: "Alice Engineer",
    email: "alice@spec-lens.dev",
    role: "engineer",
  },
  {
    name: "Bob Designer",
    email: "bob@spec-lens.dev",
    role: "designer",
  },
  {
    name: "Charlie Researcher",
    email: "charlie@spec-lens.dev",
    role: "researcher",
  },
]

// Workspace data
const workspaceData = [
  { name: "Analog Systems Lab", plan: "pro" },
  { name: "Motor Controller R&D", plan: "pro" },
  { name: "Personal Workshop", plan: "free" },
]

// Evidence types
const evidenceTypes = [
  "pinout",
  "package",
  "block-diagram",
  "timing",
  "application-circuit",
  "electrical-curve",
  "mechanical",
  "table",
  "absolute-maximum",
  "functional-diagram",
] as const

// ============================================================
// Main seed function
// ============================================================
async function seed() {
  console.log("🌱 Starting Speclens development seed...\n")

  // Seed users
  const seededUsers: typeof users.$inferSelect[] = []
  for (const u of userData) {
    const [user] = await db.insert(users).values({
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({ id: users.id })

    seededUsers.push(user)
    console.log(`  ✓ Created user: ${u.email}`)
  }

  // Seed workspaces
  const seededWorkspaces: typeof workspaces.$inferSelect[] = []
  for (let i = 0; i < workspaceData.length; i++) {
    const creator = seededUsers[i % seededUsers.length]
    const [workspace] = await db.insert(workspaces).values({
      name: workspaceData[i].name,
      plan: workspaceData[i].plan,
      createdBy: creator.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({ id: workspaces.id })

    seededWorkspaces.push(workspace)
    console.log(`  ✓ Created workspace: ${workspace.name}`)
    
    // Add creator as member
    await db.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId: creator.id,
      role: "admin",
      joinedAt: new Date(),
    })

    // Add other users as members
    for (let j = 0; j < seededUsers.length; j++) {
      if (seededUsers[j].id !== creator.id) {
        await db.insert(workspaceMembers).values({
          workspaceId: workspace.id,
          userId: seededUsers[j].id,
          role: "member",
          joinedAt: new Date(),
        })
      }
    }
  }

  // Seed datasheets
  const seededDatasheets: typeof datasheets.$inferSelect[] = []
  for (let ws = 0; ws < seededWorkspaces.length; ws++) {
    const workspace = seededWorkspaces[ws]
    const members = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspace.id))
    const memberEmails = members.map(m => m.userId)

    for (let i = 0; i < DATASHEETS_PER_WORKSPACE; i++) {
      const creator = seededUsers[((ws * DATASHEETS_PER_WORKSPACE) + i) % seededUsers.length]
      const mpns = ["LM358", "TPS5430", "STM32F405RG", "DRV8301", "TL072", "INA219", "LM324", "ESP32-WROOM-32E"]
      const mpn = mpns[i % mpns.length]
      const manufacturer = "Texas Instruments"
      const title = `${mpn} Datasheet - Workspace ${ws + 1}`
      const fileName = `${mpn}.pdf`
      const storageKey = `datasheets/${workspace.id}/${mpn}/${fileName}`
      const mimeType = "application/pdf"
      const fileSize = Math.random() * 20 + 1 // 1-20 MB
      const pageCount = Math.floor(Math.random() * 300) + 1 // 1-300 pages
      const statuses = ["pending", "indexed", "indexing", "failed"]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const indexStatuses = ["queued", "indexed", "indexing", "failed"]
      const indexStatus = indexStatuses[Math.floor(Math.random() * indexStatuses.length)]

      const [datasheet] = await db.insert(datasheets).values({
        workspaceId: workspace.id,
        mpn,
        manufacturer,
        title,
        fileName,
        storageKey,
        mimeType,
        fileSize,
        pageCount,
        status,
        indexStatus,
        favorite: Math.random() > 0.7,
        createdBy: creator.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning({ id: datasheets.id })

      seededDatasheets.push(datasheet)
      console.log(`  ✓ Created datasheet: ${title} (${workspace.name})`)

      // Seed pages for this datasheet
      for (let p = 1; p <= Math.min(5, pageCount); p++) {
        const pageStorageKey = `pages/${datasheet.id}/page-${p}.png`
        const pageText = `Page ${p} text content - schematic excerpt for ${mpn}`
        
        await db.insert(datasheetPages).values({
          datasheetId: datasheet.id,
          pageNumber: p,
          width: Math.random() * 600 + 800, // 800-1400
          height: Math.random() * 800 + 600, // 600-1400
          storageKey: pageStorageKey,
          text: pageText,
          createdAt: new Date(),
        })
      }

      // Seed evidence for this datasheet
      for (let e = 0; e < EVIDENCES_PER_DATASHEET; e++) {
        const etype = evidenceTypes[Math.floor(Math.random() * evidenceTypes.length)]
        const pageNum = Math.floor(Math.random() * pageCount) + 1
        const bboxX = Math.random() * 0.4 // 0.0-0.4 so bbox fits within page
        const bboxY = Math.random() * 0.5
        const bboxWidth = 0.2 + Math.random() * 0.5 // 0.2-0.7
        const bboxHeight = 0.1 + Math.random() * 0.4 // 0.1-0.5
        const confidence = (Math.random() * 0.3 + 0.7).toFixed(3) // 0.7-1.0
        const verificationStates = ["verified", "unverified", "flagged"]
        const verificationState = verificationStates[Math.floor(Math.random() * verificationStates.length)]
        const captions = [
          "Pin 1 configuration",
          "Package outline drawing",
          "Timing diagram",
          "Application circuit connection",
          "Electrical curve measurement",
          "Mechanical drawing",
        ]
        const caption = captions[Math.floor(Math.random() * captions.length)]
        const modelVersions = ["speclens-retrieval-demo-0.4.2", "speclens-v1", "speclens-v2"]
        const modelVersion = modelVersions[Math.floor(Math.random() * modelVersions.length)]

        await db.insert(evidence).values({
          workspaceId: workspace.id,
          datasheetId: datasheet.id,
          pageId: null, // will be set after pages are created; using null for now
          componentId: null,
          mpn,
          manufacturer,
          title: `${mpn} evidence ${e + 1}`,
          evidenceType: etype,
          pageNumber: pageNum,
          bboxX: parseFloat(bboxX.toFixed(3)),
          bboxY: parseFloat(bboxY.toFixed(3)),
          bboxWidth: parseFloat(bboxWidth.toFixed(3)),
          bboxHeight: parseFloat(bboxHeight.toFixed(3)),
          confidence: parseFloat(confidence),
          verificationState,
          caption,
          cropStorageKey: `crops/${datasheet.id}/evidence-${e + 1}.png`,
          retrievalScore: (Math.random() * 0.5 + 0.5).toFixed(3), // 0.5-1.0
          modelVersion,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      console.log(`    - ${EVIDENCES_PER_DATASHEET} evidence records`)
    }
  }

  // Seed components
  const seededComponents: typeof components.$inferSelect[] = []
  for (let ws = 0; ws < seededWorkspaces.length; ws++) {
    const workspace = seededWorkspaces[ws]
    const member = await db.select().from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspace.id)).limit(1)
    const memberUser = await db.select().from(users).where(eq(users.id, member[0].userId))

    for (let c = 0; c < COMPONENTS_PER_WORKSPACE; c++) {
      const mpns = ["LM358", "TPS5430", "STM32F405RG", "DRV8301", "TL072", "INA219"]
      const mpn = mpns[Math.floor(Math.random() * mpns.length)]
      const family = c === 0 ? "Operational Amplifier" : "Microcontroller"
      const description = `${mpn} - Precision integrated circuit for signal conditioning`
      const packages = ['SOIC-8', 'TSSOP-8']
      const specifications = JSON.stringify({
        voltage: Math.random() * 5 + 2.5, // 2.5-7.5V
        current: Math.random() * 0.1 + 0.01, // 10mA-110mA
        temperature: Math.random() * 125 + -40, // -40 to +85°C
      })
      const verifiedSpecifications = JSON.stringify({
        voltage: Math.round((Math.random() * 5 + 2.5) * 10) / 10,
        current: Math.round((Math.random() * 0.1 + 0.01) * 100) / 100,
      })
      const history = JSON.stringify([
        { date: "2026-08-15", action: "added to database", by: memberUser[0].name },
      ])

      const [component] = await db.insert(components).values({
        mpn,
        manufacturer: "Texas Instruments",
        family,
        description,
        packages,
        specifications,
        verifiedSpecifications,
        history,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning({ id: components.id })

      seededComponents.push(component)
      console.log(`  ✓ Created component: ${mpn} (${workspace.name})`)
    }
  }

  // Seed component relationships
  for (const component of seededComponents) {
    // Create 0-2 random relationships with other components
    const potentialPeers = seededComponents.filter(c => c.id !== component.id)
    if (potentialPeers.length > 0) {
      const numPeers = Math.floor(Math.random() * 2) // 0 or 1 peer
      const peers = getRandomSample(potentialPeers, numPeers)
      
      for (const peer of peers) {
        const relationshipTypes = ["similar", "alternative", "subcomponent"]
        const relType = relationshipTypes[Math.floor(Math.random() * relationshipTypes.length)]
        
        await db.insert(componentRelationships).values({
          sourceComponentId: component.id,
          targetComponentId: peer.id,
          relationshipType: relType,
          createdAt: new Date(),
        })
      }
    }
  }
  console.log("  ✓ Created component relationships")

  // Seed collections
  for (let ws = 0; ws < seededWorkspaces.length; ws++) {
    const workspace = seededWorkspaces[ws]

    for (let c = 0; c < COLLECTIONS_PER_WORKSPACE; c++) {
      const name = `Collection ${c + 1} - ${workspace.name}`
      const description = `A curated collection of datasheets and evidence from ${workspace.name}`
      const creator = seededUsers[ws % seededUsers.length]

      const [collection] = await db.insert(collections).values({
        workspaceId: workspace.id,
        name,
        description,
        createdBy: creator.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning({ id: collections.id })

      // Add some datasheets to the collection
      const workspaceDatasheets = seededDatasheets.filter(ds => ds.workspaceId === workspace.id)
      const numDatasheets = Math.min(Math.floor(Math.random() * workspaceDatasheets.length) + 1, workspaceDatasheets.length)
      const selectedDs = getRandomSample(workspaceDatasheets, numDatasheets)
      
      for (const ds of selectedDs) {
        await db.insert(collectionItems).values({
          collectionId: collection.id,
          itemType: "datasheet",
          itemId: ds.id,
        })
      }

      // Add some evidence to the collection
      const workspaceEvidence = await db.select().from(evidence).where(eq(evidence.workspaceId, workspace.id))
      const numEvidence = Math.min(Math.floor(Math.random() * workspaceEvidence.length) + 1, workspaceEvidence.length)
      const selectedEvidence = getRandomSample(workspaceEvidence, numEvidence)
      
      for (const ev of selectedEvidence) {
        await db.insert(collectionItems).values({
          collectionId: collection.id,
          itemType: "evidence",
          itemId: ev.id,
        })
      }

      console.log(`  ✓ Created collection: ${collection.name} (${numDatasheets} datasheets, ${numEvidence} evidence)`)
    }
  }

  // Seed processing jobs
  for (let ws = 0; ws < seededWorkspaces.length; ws++) {
    const workspace = seededWorkspaces[ws]

    for (let j = 0; j < PROCESSING_JOBS_PER_WORKSPACE; j++) {
      const mpns = ["LM358", "TPS5430", "STM32F405RG", "DRV8301", "TL072", "INA219"]
      const mpn = mpns[Math.floor(Math.random() * mpns.length)]
      const statuses = ["queued", "processing", "completed", "failed", "cancelled"]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      const progress = status === "completed" || status === "failed" || status === "cancelled" ? 
        (Math.random() * 100).toFixed(1) : 
        (Math.random() * 50).toFixed(1) // 0-50% for active jobs
      
      const startedAt = status === "completed" || status === "failed" || status === "cancelled" 
        ? new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000) : // past few days
        new Date(Date.now() - 24 * 60 * 60 * 1000) // yesterday
      
      const completedAt = status === "completed" 
        ? new Date(startedAt.getTime() + Math.random() * 6 * 60 * 60 * 1000) : // a few hours later
        status === "failed"
          ? new Date(startedAt.getTime() + Math.random() * 6 * 60 * 60 * 1000)
          : null
      
      const error = status === "failed" ? "Simulated processing error" : null
      const duration = status === "completed" ? Math.random() * 3600 : null // seconds
      const pages = Math.floor(Math.random() * 10) + 1
      const fileSize = Math.random() * 20 + 1

      const [job] = await db.insert(processingJobs).values({
        workspaceId: workspace.id,
        fileName: `${mpn}_spec.pdf`,
        storageKey: `jobs/${workspace.id}/${mpn}/${Date.now()}_${mpn}.pdf`,
        mimeType: "application/pdf",
        fileSize,
        mpn,
        status,
        progress: parseFloat(progress),
        startedAt,
        completedAt,
        error,
        duration: parseFloat(duration.toString()),
        pages,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning({ id: processingJobs.id })

      // Seed processing stages for this job
      const stageNames = ["ingest", "render", "layout", "regions", "embed", "index", "verify"]
      const numStages = Math.min(7, Math.floor(Math.random() * 7) + 1) // 1-7 stages
      
      for (let s = 0; s < numStages; s++) {
        const stageName = stageNames[s]
        const stageStatus = s < numStages - 1 ? "completed" : // all but last are complete
          status === "processing" && s === 0 ? "in_progress" : // first stage in progress if processing
          status === "queued" ? "pending" : // queued jobs have pending stages
          "completed"
        
        const stageStartedAt = status === "queued" 
          ? null 
          : s === 0
            ? startedAt 
            : new Date(startedAt.getTime() + Math.random() * 2 * 60 * 60 * 1000)
        
        const stageCompletedAt = s === numStages - 1 && stageStatus === "completed"
          ? new Date(stageStartedAt.getTime() + Math.random() * 2 * 60 * 60 * 1000)
          : stageStatus === "in_progress"
            ? null
            : stageStatus === "completed" && s < numStages - 1
              ? new Date(stageStartedAt.getTime() + Math.random() * 2 * 60 * 60 * 1000)
              : null
        
        const stageError = stageStatus === "failed" ? "Stage error" : null

        await db.insert(processingStages).values({
          processingJobId: job.id,
          stage: stageName,
          status: stageStatus,
          startedAt: stageStartedAt,
          completedAt: stageCompletedAt,
          error: stageError,
        })
      }
      console.log(`  ✓ Created processing job: ${mpn} (${workspace.name}) - ${status}`)
    }
  }

  // Seed search history
  for (let ws = 0; ws < seededWorkspaces.length; ws++) {
    const workspace = seededWorkspaces[ws]
    const user = seededUsers[ws % seededUsers.length]

    const queries = [
      "operational amplifier circuit",
      "motor driver datasheet",
      "STM32 sensor configuration",
      "power supply design",
      "voltage regulator performance",
    ]
    const query = queries[Math.floor(Math.random() * queries.length)]
    const resultCount = Math.floor(Math.random() * 50) + 1 // 1-50 results

    await db.insert(searchHistory).values({
      workspaceId: workspace.id,
      userId: user.id,
      query,
      filters: JSON.stringify({ types: ["pinout", "block-diagram"] }),
      resultCount,
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // past week
    })
  }
  console.log("  ✓ Created search history records")

  // Seed activity events
  const eventKinds = ["index", "detect", "query", "verify", "error"]
  for (let ws = 0; ws < seededWorkspaces.length; ws++) {
    const workspace = seededWorkspaces[ws]

    for (let a = 0; a < 3; a++) {
      const kind = eventKinds[Math.floor(Math.random() * eventKinds.length)]
      const entityTypes = ["datasheet", "evidence", "component"]
      const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)]
      const entityId = seededDatasheets[Math.floor(Math.random() * seededDatasheets.length)].id
      const detail = kind === "error" ? "Simulated error during indexing" : ` ${kind} operation completed`
      const title = `${kind.charAt(0).toUpperCase() + kind.slice(1)} event`
      
      await db.insert(activityEvents).values({
        userId: seededUsers[a % seededUsers.length].id,
        workspaceId: workspace.id,
        eventType: kind,
        entityType,
        entityId,
        metadata: JSON.stringify({ source: "seed", timestamp: new Date().toISOString() }),
        createdAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
      })
    }
  }
  console.log("  ✓ Created activity events")

  // Seed notifications
  const notificationTypes = ["success", "info", "error"]
  for (let ws = 0; ws < seededWorkspaces.length; ws++) {
    const workspace = seededWorkspaces[ws]
    const user = seededUsers[ws % seededUsers.length]

    for (let n = 0; n < 2; n++) {
      await db.insert(notifications).values({
        userId: user.id,
        workspaceId: workspace.id,
        title: `SpecLens Notification #${n + 1}`,
        message: `This is a development test notification from ${workspace.name}`,
        type: notificationTypes[Math.floor(Math.random() * notificationTypes.length)],
        read: Math.random() > 0.5,
        createdAt: new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000),
      })
    }
  }
  console.log("  ✓ Created notifications")

  // Seed copilot conversations
  for (let ws = 0; ws < seededWorkspaces.length; ws++) {
    const workspace = seededWorkspaces[ws]
    const user = seededUsers[ws % seededUsers.length]

    const [conversation] = await db.insert(copilotConversations).values({
      workspaceId: workspace.id,
      userId: user.id,
      title: `SpecLens Discussion - ${workspace.name}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({ id: copilotConversations.id })

    // Add a few messages
    const messageRoles = ["user", "assistant"]
    const messageContents = [
      "I'm looking for pinout information on the LM358.",
      "The pinout is typically SOIC-8 with pin 1 as input, pin 2 as negative input, etc.",
      "What about the TPS5430 switching frequency?",
      "The TPS5430 has a switching frequency range of 300kHz to 2MHz.",
      "Can you help me find evidence for the INA219 current monitor?",
      "I found some evidence for the INA219 with confidence 0.92.",
    ]

    for (let m = 0; m < 3; m++) {
      const role = messageRoles[m % 2]
      const content = messageContents[m]
      const sources = m >= 2 ? [{ evidenceId: "ev_001", page: 1, confidence: 0.92 }] : undefined
      const confidence = m >= 2 ? 0.92 : undefined

      await db.insert(copilotMessages).values({
        conversationId: conversation.id,
        role,
        content,
        sources: JSON.stringify(sources),
        confidence: confidence,
        createdAt: new Date(Date.now() - m * 60 * 60 * 1000), // spaced over last few hours
      })
    }
    console.log(`  ✓ Created copilot conversation: ${conversation.title}`)
  }

  // Seed symbols
  for (let ws = 0; ws < seededWorkspaces.length; ws++) {
    const workspace = seededWorkspaces[ws]
    const component = seededComponents[ws % seededComponents.length]

    const [symbol] = await db.insert(symbols).values({
      workspaceId: workspace.id,
      componentId: component.id,
      package: "SOIC-8",
      stage: "design",
      validationState: "pending",
      generatedSource: null,
      generatedMetadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning({ id: symbols.id })

    console.log(`  ✓ Created symbol: for ${component.mpn} (${workspace.name})`)

    // Seed symbol pins
    const pinNumbers = [1, 2, 3, 4, 5, 6, 7, 8]
    const pinNames = ["VCC", "VSS", "INPUT", "IN+", "IN-", "OUTPUT", "NC", "NC"]
    const electricalTypes = ["power", "ground", "signal", "signal", "signal", "output", "no-connect", "no-connect"]

    for (let p = 0; p < pinNumbers.length; p++) {
      const evidenceId = p === 0 || p === 1 ? null : // VCC and VSS have no evidence evidenceId
        Math.random() > 0.5 ? `ev_${Math.floor(Math.random() * 50) + 1}` : null

      await db.insert(symbolPins).values({
        symbolId: symbol.id,
        number: pinNumbers[p],
        name: pinNames[p],
        type: "electrical",
        position: JSON.stringify({ x: p * 20, y: 0 }),
        electricalType: electricalTypes[p],
        evidenceId: evidenceId ? parseInt(evidenceId) : null,
      })
    }
    console.log(`    - ${pinNumbers.length} symbol pins`)
  }

  // Seed document and evidence embeddings (pgvector preparation)
  console.log("  ✓ pgvector tables prepared (no vectors generated)")
  
  // The embedding tables are already created via schema.
  // Seed data just notes that they're ready for pgvector.
  // In a real deployment, vectors would be generated by the embedding model.
  
  console.log("\n🌱 Seed complete! Development data ready.\n")
  console.log("Note: All seed data is development/demo only.")
  console.log("      Use with PostgreSQL and set DATABASE_URL in .env.")
}

// Helper: get random sample from array
function getRandomSample<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(n, shuffled.length))
}

// ============================================================
// Run seed if DATABASE_URL is available
// ============================================================

const databaseUrl = process.env.DATABASE_URL
if (databaseUrl) {
  seed().catch((err) => {
    console.error("❌ Seed failed:", err)
    process.exit(1)
  })
} else {
  console.log("ℹ️  DATABASE_URL not set - seed data definitions ready but not executed")
  console.log("    Set DATABASE_URL and re-run to populate the database.")
  // Still export the seed data structure for reference
  console.log("\nSeed data structure:")
  console.log("- 3 users across 3 workspaces")
  console.log("- Each workspace has 4 datasheets with pages and evidence")
  console.log("- Each workspace has 2 components with relationships")
  console.log("- Each workspace has 2 collections with join data")
  console.log("- Each workspace has 3 processing jobs with stages")
  console.log("- Search history, activity, notifications, copilot conversations")
  console.log("- Symbols with pins prepared")
  console.log("- Embedding tables ready for pgvector")
}

export { seed }