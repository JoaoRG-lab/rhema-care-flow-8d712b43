export const EPIC_CTA_TEMPLATE = {
  subject: "🌍 The Future of Healthcare is Here — And It's Free (For Now)",
  body: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.8; color: #1a1a1a; margin: 0; padding: 0; }
    .container { max-width: 680px; margin: 0 auto; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .logo-text { font-size: 28px; font-weight: bold; background: linear-gradient(135deg, #2D8B74, #3AA88F, #D4A543); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .tagline { color: #666; font-size: 14px; margin-top: 8px; }
    h1 { font-size: 32px; color: #1a1a1a; margin-bottom: 20px; line-height: 1.3; }
    .highlight { background: linear-gradient(135deg, #2D8B74, #3AA88F); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: bold; }
    .content { font-size: 16px; color: #333; }
    .cta-section { text-align: center; margin: 40px 0; padding: 40px; background: linear-gradient(135deg, #f8fffe, #f0f9f6); border-radius: 16px; border: 2px solid #2D8B74; }
    .cta-button { display: inline-block; padding: 18px 48px; background: linear-gradient(135deg, #2D8B74, #3AA88F); color: white !important; text-decoration: none; border-radius: 50px; font-weight: bold; font-size: 18px; box-shadow: 0 8px 24px rgba(45, 139, 116, 0.3); }
    .features { display: grid; gap: 16px; margin: 30px 0; }
    .feature { padding: 16px; background: #f9f9f9; border-radius: 12px; border-left: 4px solid #2D8B74; }
    .feature-title { font-weight: bold; color: #2D8B74; margin-bottom: 4px; }
    .warning-box { background: #fff8e6; border: 1px solid #d4a543; border-radius: 12px; padding: 24px; margin: 30px 0; }
    .warning-title { color: #b8860b; font-weight: bold; font-size: 18px; margin-bottom: 12px; }
    .signature { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
    .signature-name { font-weight: bold; color: #2D8B74; }
    .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo-text">UHS Health OS</div>
      <div class="tagline">Universal Health System — The Operating System for Healthcare</div>
    </div>

    <h1>Dear {{name}},</h1>
    
    <div class="content">
      <p>I'm reaching out to <strong>{{organization}}</strong> because what we're building will fundamentally transform how healthcare knowledge flows across the globe — and I believe you should be among the first to experience it.</p>

      <p><span class="highlight">UHS Health OS</span> is not just another healthcare platform. It's a <strong>Universal Health Operating System</strong> — a comprehensive ecosystem that unifies:</p>

      <div class="features">
        <div class="feature">
          <div class="feature-title">🧠 AI-Powered Clinical Intelligence</div>
          Evidence-based decision support with real-time literature mining from NEJM, Lancet, ACR, EULAR, and global medical sources
        </div>
        <div class="feature">
          <div class="feature-title">⛓️ Blockchain-Verified Integrity</div>
          Every clinical insight, score, and knowledge artifact is anchored on Solana with immutable audit trails — no PHI on-chain, only cryptographic proofs
        </div>
        <div class="feature">
          <div class="feature-title">📊 Universal Risk Value (URV) Scoring</div>
          A revolutionary health value chain that quantifies outcomes, processes, infrastructure, and experience across the entire healthcare continuum
        </div>
        <div class="feature">
          <div class="feature-title">🌍 Multi-Specialty, Multi-Language</div>
          Starting with Rheumatology, expanding to all specialties — built for global healthcare professionals
        </div>
      </div>

      <div class="cta-section">
        <h2 style="margin-top: 0; color: #1a1a1a;">Experience the Future — Free</h2>
        <p style="color: #666; margin-bottom: 24px;">No credit card. No commitment. Just pure innovation.</p>
        <a href="https://rhema-care-flow.lovable.app" class="cta-button">Try UHS Health OS Now →</a>
      </div>

      <div class="warning-box">
        <div class="warning-title">⚠️ A Word of Transparency</div>
        <p style="margin: 0; color: #666;">This platform is <strong>free today</strong>. But this window won't last forever.</p>
        <p style="margin: 12px 0 0 0; color: #666;">The convergence of AI, blockchain, and healthcare is happening whether we're ready or not. The institutions that embrace this transformation early will shape the future of medicine. Those who wait may find themselves adapting to a world they didn't help create.</p>
        <p style="margin: 12px 0 0 0; color: #333; font-weight: 500;"><em>This will happen — with us or without us, by my hands or others. The only question is: will you be part of writing this chapter of medical history?</em></p>
      </div>

      <p>I would be honored to discuss how <strong>{{organization}}</strong> could leverage this platform for research, education, clinical practice, or innovation initiatives.</p>
    </div>

    <div class="signature">
      <p><span class="signature-name">Novus Oriens</span><br>
      Universal Health System Ambassador<br>
      <a href="mailto:orienta@novusoriens.org" style="color: #2D8B74;">orienta@novusoriens.org</a></p>
    </div>

    <div class="footer">
      <p>UHS Health OS — Where Evidence Meets Innovation</p>
      <p>Privacy-First • Blockchain-Verified • Clinically Validated</p>
    </div>
  </div>
</body>
</html>`,
};
