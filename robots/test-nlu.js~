
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1');
const { IamAuthenticator } = require('ibm-watson/auth');

// Substitua pelos seus dados reais:
const apiKey = 'r58T-lP7OLAQAa58Lp-jP40kY8qj0Qta92EfNLCwnxZ9';
const serviceUrl = 'https://api.us-east.natural-language-understanding.watson.cloud.ibm.com/instances/b999703e-c542-4c9e-b0a0-2de2d2852d48';

const nlu = new NaturalLanguageUnderstandingV1({
  version: '2023-08-01',
  authenticator: new IamAuthenticator({
    apikey: apiKey,
  }),
  serviceUrl: serviceUrl,
});

async function testNLU() {
  const textToAnalyze = 'Michael Jackson was a legendary singer and performer.';
  try {
    const response = await nlu.analyze({
      text: textToAnalyze,
      features: {
        keywords: {
          limit: 5,
        },
      },
    });

    if (!response || !response.result || !response.result.keywords) {
      console.error('Resposta inesperada do Watson:', response);
      return;
    }

    console.log('Keywords extraídas:', response.result.keywords.map(k => k.text));
  } catch (error) {
    console.error('Erro ao chamar Watson NLU:', error);
  }
}

testNLU();
