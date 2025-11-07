import { backblazeStorage } from "./backblazeStorage";
import { db } from "./db";
import { knowledgeBase } from "@shared/schema";

/**
 * Seed the knowledge base with professional logistics feedback
 * This pre-populates the system with expert analysis for common scenarios
 */

const professionalKnowledgeTemplates = [
  {
    operationType: "air",
    projectCategory: "import",
    shippingMode: "air freight",
    priority: "high",
    analysis: `📊 **Current Status**: High-priority air freight import operation in progress. All critical documentation appears to be in order.

🔔 **Key Updates**: 
- Air Waybill (AWB) received and validated
- Customs clearance initiated at destination airport
- Estimated delivery timeline within 48-72 hours
- Freight forwarder coordination confirmed

⚠️ **Action Items**:
1. **URGENT**: Verify commercial invoice matches packing list quantities
2. Confirm import duties and taxes calculation with customs broker
3. Coordinate final mile delivery with local carrier
4. Ensure Certificate of Origin is available if required for duty relief

📅 **Next Steps**:
- Monitor customs clearance status (check within 12 hours)
- Prepare for potential customs inspection
- Coordinate delivery timing with consignee
- Arrange payment of duties and import fees

💡 **Recommendations**:
- Maintain regular communication with customs broker
- Prepare alternative delivery plans in case of delays
- Review and validate all documentation before customs presentation
- Consider express clearance if time-critical`,
    tags: ["air freight", "import", "customs", "high-priority", "urgent"],
    emailCount: 12,
    taskCount: 8,
    fileCount: 15
  },
  {
    operationType: "sea",
    projectCategory: "export",
    shippingMode: "FCL",
    priority: "medium",
    analysis: `📊 **Current Status**: Full Container Load (FCL) export operation progressing smoothly. Container booking confirmed and documentation in preparation.

🔔 **Key Updates**:
- Shipping line booking reference received
- Container yard (CY) cut-off date confirmed
- Export documentation package initiated
- Shipper's Letter of Instruction (SLI) submitted

⚠️ **Action Items**:
1. Complete commercial invoice and packing list finalization
2. Obtain export license if required for controlled commodities
3. Coordinate container pickup from warehouse
4. Submit VGM (Verified Gross Mass) before cut-off
5. Arrange cargo insurance coverage

📅 **Next Steps**:
- Confirm container stuffing schedule (48 hours before CY cut-off)
- Submit Bill of Lading instructions to freight forwarder
- Verify all export compliance requirements met
- Coordinate payment of ocean freight charges

💡 **Recommendations**:
- Schedule cargo ready date 3-5 days before CY cut-off for buffer
- Double-check HS codes for accurate duty classification
- Ensure proper cargo securit and dunnage in container
- Maintain digital copies of all shipping documents`,
    tags: ["sea freight", "FCL", "export", "container", "documentation"],
    emailCount: 18,
    taskCount: 12,
    fileCount: 22
  },
  {
    operationType: "sea",
    projectCategory: "import",
    shippingMode: "LCL",
    priority: "low",
    analysis: `📊 **Current Status**: Less-than-Container Load (LCL) import shipment in transit. Standard processing timeline being followed.

🔔 **Key Updates**:
- Cargo departed from origin port on schedule
- Estimated Time of Arrival (ETA) at destination confirmed
- Consolidation completed at origin warehouse
- Ocean Bill of Lading issued

⚠️ **Action Items**:
1. Monitor vessel tracking for any schedule changes
2. Prepare customs entry documentation ahead of arrival
3. Arrange de-consolidation and final delivery
4. Confirm import duties calculation with broker
5. Verify warehouse receiving capacity

📅 **Next Steps**:
- Track vessel ETA updates weekly
- Submit ISF (Importer Security Filing) if US-bound
- Coordinate customs clearance 5-7 days before arrival
- Arrange final delivery to consignee warehouse

💡 **Recommendations**:
- LCL shipments have longer lead times due to consolidation
- Factor in 3-5 days de-consolidation time at destination
- Maintain buffer for potential customs inspections
- Consider cost-benefit of expedited customs clearance`,
    tags: ["sea freight", "LCL", "import", "consolidation", "standard"],
    emailCount: 8,
    taskCount: 6,
    fileCount: 10
  },
  {
    operationType: "land",
    projectCategory: "domestic",
    shippingMode: "truck",
    priority: "high",
    analysis: `📊 **Current Status**: Urgent domestic ground shipment scheduled for immediate dispatch. Critical timeline requires close monitoring.

🔔 **Key Updates**:
- Truck assigned and driver confirmed
- Pickup scheduled within next 4-8 hours
- Direct route planned to minimize transit time
- Real-time GPS tracking activated

⚠️ **Action Items**:
1. **URGENT**: Confirm cargo ready for immediate pickup
2. Verify delivery address and contact information
3. Ensure proper packaging and labeling completed
4. Coordinate receiver availability for unloading
5. Prepare proof of delivery requirements

📅 **Next Steps**:
- Monitor GPS tracking every 2-4 hours
- Communicate any delays immediately to all parties
- Coordinate delivery appointment with receiver
- Arrange backup delivery window if needed

💡 **Recommendations**:
- Keep receiver informed of estimated arrival time
- Have alternative delivery contact available
- Ensure adequate unloading equipment at destination
- Document any special handling requirements clearly
- Consider temperature control if cargo is sensitive`,
    tags: ["ground", "domestic", "urgent", "truck", "tracking"],
    emailCount: 5,
    taskCount: 4,
    fileCount: 6
  },
  {
    operationType: "air",
    projectCategory: "export",
    shippingMode: "air freight",
    priority: "high",
    analysis: `📊 **Current Status**: High-priority air export shipment being prepared for urgent international delivery. Time-sensitive handling required.

🔔 **Key Updates**:
- Air freight booking confirmed with major carrier
- Export packing list and commercial invoice finalized
- Dangerous goods declaration prepared (if applicable)
- Security screening appointment scheduled

⚠️ **Action Items**:
1. **URGENT**: Complete export customs declaration
2. Verify all IATA regulations compliance for air cargo
3. Confirm weight and dimensions for accurate pricing
4. Arrange cargo pickup from shipper facility
5. Submit pre-alert notification to consignee

📅 **Next Steps**:
- Coordinate cargo delivery to airline 4-6 hours before flight
- Monitor flight schedule for any changes
- Track customs clearance at destination
- Arrange final delivery coordination

💡 **Recommendations**:
- Air freight requires precise documentation - double-check all details
- Consider battery regulations if shipping electronics
- Verify destination country import requirements early
- Maintain clear communication channel with receiver
- Have contingency plan for flight delays or cancellations`,
    tags: ["air freight", "export", "urgent", "IATA", "time-sensitive"],
    emailCount: 10,
    taskCount: 9,
    fileCount: 14
  },
  {
    operationType: "multimodal",
    projectCategory: "import",
    shippingMode: "sea-land",
    priority: "medium",
    analysis: `📊 **Current Status**: Multimodal import combining ocean and ground transportation. Coordination between modes proceeding as planned.

🔔 **Key Updates**:
- Ocean leg completed, cargo arrived at port
- Port de-vanning scheduled within 48 hours
- Ground transportation carrier assigned
- Intermodal transfer documentation prepared

⚠️ **Action Items**:
1. Coordinate customs clearance at port of entry
2. Arrange container de-vanning and cargo inspection
3. Confirm ground carrier pickup schedule
4. Verify final delivery address and requirements
5. Monitor for any demurrage or detention charges

📅 **Next Steps**:
- Complete customs clearance before container release
- Coordinate seamless transfer between ocean and ground carrier
- Track inland transportation progress
- Confirm delivery appointment with final consignee

💡 **Recommendations**:
- Multimodal requires precise timing between transportation modes
- Factor in buffer time for mode transitions (24-48 hours)
- Verify cargo insurance covers entire multimodal journey
- Maintain documentation for each transportation leg
- Consider port congestion when planning schedules`,
    tags: ["multimodal", "import", "coordination", "ocean", "ground"],
    emailCount: 15,
    taskCount: 11,
    fileCount: 18
  }
];

export async function seedKnowledgeBase() {
  console.log('[Knowledge Seed] Starting to populate knowledge base with professional logistics feedback...');
  
  for (const template of professionalKnowledgeTemplates) {
    try {
      // Create knowledge document
      const knowledgeDoc = {
        analysisText: template.analysis,
        operationData: {
          type: template.operationType,
          category: template.projectCategory,
          shippingMode: template.shippingMode,
          priority: template.priority,
          status: 'active'
        },
        insights: {
          commonIssues: extractIssues(template.analysis),
          recommendations: extractRecommendations(template.analysis),
          documentationNeeds: extractDocumentation(template.analysis)
        },
        metadata: {
          emailCount: template.emailCount,
          taskCount: template.taskCount,
          fileCount: template.fileCount,
          createdAt: new Date()
        }
      };

      // Save to Backblaze
      const b2Key = `knowledge-base/seed-${template.operationType}-${template.projectCategory}-${Date.now()}.json`;
      const buffer = Buffer.from(JSON.stringify(knowledgeDoc, null, 2), 'utf-8');
      
      await backblazeStorage.uploadFile(buffer, b2Key, {
        'content-type': 'application/json',
        'x-knowledge-type': template.operationType,
        'x-knowledge-category': template.projectCategory,
        'x-knowledge-source': 'professional-seed'
      });

      // Index in database
      await db.insert(knowledgeBase).values({
        b2Key,
        operationType: template.operationType,
        projectCategory: template.projectCategory,
        shippingMode: template.shippingMode,
        priority: template.priority,
        emailCount: template.emailCount,
        taskCount: template.taskCount,
        fileCount: template.fileCount,
        tags: template.tags,
        usageCount: 1,
        qualityScore: 10, // Max quality for professional templates
      });

      console.log(`[Knowledge Seed] ✅ Created: ${template.operationType} - ${template.projectCategory} - ${template.shippingMode}`);

    } catch (error: any) {
      console.error(`[Knowledge Seed] ❌ Error creating template:`, error.message);
    }
  }

  console.log('[Knowledge Seed] 🎉 Knowledge base population completed!');
}

function extractIssues(analysis: string): string[] {
  const issues: string[] = [];
  const lines = analysis.split('\n');
  for (const line of lines) {
    if (line.includes('**Action Items**:') || line.includes('URGENT')) {
      issues.push(line.trim());
    }
  }
  return issues.slice(0, 5);
}

function extractRecommendations(analysis: string): string[] {
  const recommendations: string[] = [];
  const lines = analysis.split('\n');
  let inRecommendations = false;
  
  for (const line of lines) {
    if (line.includes('**Recommendations**:')) {
      inRecommendations = true;
      continue;
    }
    if (inRecommendations && line.trim().startsWith('-')) {
      recommendations.push(line.trim());
    }
  }
  return recommendations;
}

function extractDocumentation(analysis: string): string[] {
  const docs: string[] = [];
  const text = analysis.toLowerCase();
  
  const docTypes = [
    'commercial invoice', 'packing list', 'bill of lading', 'certificate of origin',
    'air waybill', 'customs declaration', 'import license', 'export license'
  ];
  
  for (const docType of docTypes) {
    if (text.includes(docType)) {
      docs.push(docType);
    }
  }
  
  return docs;
}
