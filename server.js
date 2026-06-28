const express = require("express");
const cors    = require("cors");
const app     = express();

app.use(cors({ origin: "*" }));

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken() {
  const res = await fetch(
    "https://openapi.koreainvestment.com:9443/oauth2/tokenP",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey:    process.env.KIS_APP_KEY,
        appsecret: process.env.KIS_APP_SECRET,
      }),
    }
  );
  const data = await res.json();
  return {
    token:     data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
}

async function ensureToken() {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const result = await getToken();
  cachedToken    = result.token;
  tokenExpiresAt = result.expiresAt;
  return cachedToken;
}

app.get("/api/portfolio", async (req, res) => {
  try {
    const token = await ensureToken();
    const url =
      "https://openapi.koreainvestment.com:9443" +
      "/uapi/domestic-stock/v1/trading/inquire-balance" +
      "?CANO=" + process.env.KIS_CANO +
      "&ACNT_PRDT_CD=" + process.env.KIS_ACNT_PRDT_CD +
      "&AFHR_FLPR_YN=N&OFL_YN=&INQR_DVSN=02&UNPR_DVSN=01" +
      "&FUND_STTL_ICLD_YN=N&FNCG_AMT_AUTO_RDPT_YN=N&PRCS_DVSN=00" +
      "&CTX_AREA_FK100=&CTX_AREA_NK100=";

    const balRes = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        appkey:         process.env.KIS_APP_KEY,
        appsecret:      process.env.KIS_APP_SECRET,
        tr_id:          "TTTC8434R",
        custtype:       "P",
        "content-type": "application/json; charset=utf-8",
      },
    });

    const data = await balRes.json();
    if (!data.output1) return res.status(500).json({ ok:false, error:data.msg1 });

    const stocks = data.output1
      .filter(i => parseInt(i.hldg_qty) > 0)
      .map(i => ({
        name:    i.prdt_name,
        qty:     parseInt(i.hldg_qty),
        avg:     parseInt(i.pchs_avg_pric),
        current: parseInt(i.prpr),
        pnl:     parseInt(i.evlu_pfls_amt),
      }));

    res.json({ ok: true, data: stocks });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "KAE 서버 실행 중" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`포트 ${PORT} 실행`));
