// TOOL: CRM sync — sync leads, content, and sequences to database for unified tracking
const { query } = require("./db");

async function syncLeadToDatabase(emailId, scoreData) {
  try {
    await query(
      `INSERT INTO vg_crm_leads (email_id, email_address, lead_score, status, created_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (email_id) DO UPDATE SET lead_score=$3, updated_at=now()`,
      [emailId, scoreData.from, scoreData.score, scoreData.intent]
    );
  } catch (err) {
    console.error(`[crm-sync] lead sync error:`, err.message);
  }
}

async function syncContentApprovalToDatabase(draftId, platforms) {
  try {
    await query(
      `INSERT INTO vg_crm_content (draft_id, title, platforms, status, published_at)
       SELECT $1, title, $2, 'published', now()
       FROM vg_content_drafts WHERE id=$1
       ON CONFLICT (draft_id) DO UPDATE SET platforms=$2, status='published', published_at=now()`,
      [draftId, platforms.join(", ")]
    );
  } catch (err) {
    console.error(`[crm-sync] content sync error:`, err.message);
  }
}

async function syncSequenceProgressToDatabase(sequenceId) {
  try {
    const { rows: seq } = await query(
      `SELECT * FROM vg_email_sequences WHERE id=$1`,
      [sequenceId]
    );

    if (!seq.length) return;

    const sequence = seq[0];

    // Count completed steps
    const { rows: steps } = await query(
      `SELECT COUNT(*) as completed FROM vg_email_sequence_steps
       WHERE sequence_id=$1 AND status='sent'`,
      [sequenceId]
    );

    await query(
      `INSERT INTO vg_crm_sales_pipeline (sequence_id, lead_email, stage, step_number, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (sequence_id) DO UPDATE SET step_number=$4, updated_at=now()`,
      [sequenceId, sequence.lead_email, "nurture", steps[0].completed]
    );
  } catch (err) {
    console.error(`[crm-sync] sequence sync error:`, err.message);
  }
}

async function getCRMDashboard() {
  try {
    const { rows: leadStats } = await query(
      `SELECT
        COUNT(*) as total_leads,
        SUM(CASE WHEN lead_score >= 80 THEN 1 ELSE 0 END) as high_value_count,
        AVG(lead_score) as avg_score
       FROM vg_crm_leads`
    );

    const { rows: contentStats } = await query(
      `SELECT COUNT(*) as total_content FROM vg_crm_content WHERE status='published'`
    );

    const { rows: sequenceStats } = await query(
      `SELECT
        COUNT(*) as total_sequences,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as active_sequences
       FROM vg_email_sequences`
    );

    const { rows: pipelineStats } = await query(
      `SELECT stage, COUNT(*) as count FROM vg_crm_sales_pipeline GROUP BY stage`
    );

    return {
      leads: {
        total: leadStats[0].total_leads || 0,
        high_value: leadStats[0].high_value_count || 0,
        avg_score: Math.round((leadStats[0].avg_score || 0) * 10) / 10,
      },
      content: {
        total_published: contentStats[0].total_content || 0,
      },
      sequences: {
        total: sequenceStats[0].total_sequences || 0,
        active: sequenceStats[0].active_sequences || 0,
      },
      pipeline: pipelineStats.reduce((acc, p) => {
        acc[p.stage] = p.count;
        return acc;
      }, {}),
    };
  } catch (err) {
    console.error(`[crm-sync] dashboard error:`, err.message);
    return null;
  }
}

module.exports = { syncLeadToDatabase, syncContentApprovalToDatabase, syncSequenceProgressToDatabase, getCRMDashboard };
