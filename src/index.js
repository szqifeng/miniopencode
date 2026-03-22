import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 OneMindBack server running on http://localhost:${PORT}`);
  console.log(`📋 API Key: ${process.env.API_KEY ? 'configured' : 'NOT SET'}`);
  console.log(`🤖 AI Provider: ${process.env.MINIMAX_CN_API_KEY ? 'configured' : 'NOT SET'}`);
});