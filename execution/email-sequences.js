// TOOL: Email sequence automation — auto-nurture high-value leads
require("dotenv").config();
const Anthropic = require("@anthropic-ai/sdk");
const { query } = require("./db");

const anthropic = new Anthropic({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

// Email sequence templates
const SEQUENCES = {
  high_value: {
    name: "High-Value Lead Nurture",
    emails: [
      {
        delay_days: 0,
        subject_template:
          "Re: {{problem}} — cheaper solution from {{company}}",
        type: "problem_validation",
      },
      {
        delay_days: 2,
        subject_template:
          "Why {{competitor}} might be costing you {{money}} per month",
        type: "pain_point",
      },
      {
        delay_days: 4,
        subject_template:
          "Custom Discord bot case study: {{savings_amount}} saved",
        type: "social_proof",
      },
      {
        delay_days: 6,
        subject_template: "Let's build something better for you",
        type: "proposal",
      },
    ],
  },
};

async function generateSequenceEmail(lead, sequenceName, emailType, problem) {
  try {
    const prompt = `You are a sales email writer for InsurgentForge.

Write a sales email for this lead:
- Name: ${lead.from}
- Problem: ${problem}
- Type: ${emailType} (validate their pain, show cost, social proof, or proposal)

Email should:
1. Sound personal, not templated (from a human, not marketing)
2. Address their specific problem (${problem})
3. Suggest a custom Discord bot as the solution
4. Focus on cost-saving vs paid alternatives
5. End with a clear next step
6. Keep it under 200 words
7. NO clichés, NO hashtags

Return ONLY valid JSON:
{
  "subject": "compelling subject line (under 60 chars)",
  "body": "email body"
}`;

    const response = await anthropic.messages.create({
      model: "deepseek-chat",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0].type === "text" ? response.content[0].text : "";

    // Parse JSON
    let email;
    try {
      email = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        email = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse email");
      }
    }

    return email;
  } catch (err) {
    console.error(`[sequences] email generation error:`, err.message);
    throw err;
  }
}

async function launchSequenceForLead(lead) {
  try {
    // Check if lead already has a sequence
    const { rows: existing } = await query(
      `SELECT * FROM vg_email_sequences WHERE lead_id=$1 AND status='active'`,
      [lead.id]
    );

    if (existing.length > 0) {
      console.log(`[sequences] lead ${lead.id} already has active sequence`);
      return null;
    }

    // Create sequence record
    const { rows: seq } = await query(
      `INSERT INTO vg_email_sequences (lead_id, lead_email, sequence_type, status, created_at)
       VALUES ($1, $2, $3, $4, now())
       RETURNING id`,
      [lead.id, lead.from, "high_value", "active"]
    );

    const sequenceId = seq[0].id;
    const problem = lead.lead_problem || "your challenge";

    // Generate emails for each step
    const template = SEQUENCES.high_value;
    for (const step of template.emails) {
      const email = await generateSequenceEmail(
        lead,
        template.name,
        step.type,
        problem
      );

      await query(
        `INSERT INTO vg_email_sequence_steps (sequence_id, step_number, email_subject, email_body, send_after_days, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sequenceId,
          template.emails.indexOf(step) + 1,
          email.subject,
          email.body,
          step.delay_days,
          "pending",
        ]
      );
    }

    console.log(
      `[sequences] launched 4-email sequence for lead ${lead.id} (${lead.from})`
    );
    return sequenceId;
  } catch (err) {
    console.error(`[sequences] sequence launch error:`, err.message);
    throw err;
  }
}

async function launchSequencesForHighValueLeads() {
  try {
    // Get high-value leads without active sequences
    const { rows: leads } = await query(
      `SELECT m.* FROM gmail_messages m
       LEFT JOIN vg_email_sequences s ON m.id = s.lead_id AND s.status='active'
       WHERE m.lead_score >= 80 AND s.id IS NULL
       ORDER BY m.lead_score DESC LIMIT 10`,
      []
    );

    if (!leads.length) {
      console.log(`[sequences] no new high-value leads to nurture`);
      return [];
    }

    const launched = [];
    for (const lead of leads) {
      try {
        const seqId = await launchSequenceForLead(lead);
        if (seqId) launched.push(seqId);
      } catch (err) {
        console.error(`[sequences] failed for lead ${lead.id}:`, err.message);
      }
    }

    return launched;
  } catch (err) {
    console.error(`[sequences] batch launch error:`, err.message);
    return [];
  }
}

module.exports = { launchSequencesForHighValueLeads, launchSequenceForLead };
