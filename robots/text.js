  const axios = require('axios');
  const sentenceBoundaryDetection = require('sbd');
  
  const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1');
  const { IamAuthenticator } = require('ibm-watson/auth');
  const { apiKey, url } = require('../credentials/watson-nlu.json');
  
  const nlu = new NaturalLanguageUnderstandingV1({
    version: '2021-08-01',
    authenticator: new IamAuthenticator({
      apikey: apiKey,
    }),
   serviceUrl: url,
  
  });
 
const state = require('./state.js')
  module.exports = async function robot() {
  
	const content = state.load()
	  
  	await fetchContentFrom(content)
  	sanitizeContent(content)
  	breakContentIntoSentences(content)
  	console.log('🔍 Antes de limitar:', content.sentences.length, 'sentenças')
  
	limitMaximumSentences(content)

  	await fetchKeywordsOfAllSentences(content)

  	state.save(content)
  
  	async function fetchContentFrom(content) {
  		const searchTerm = content.searchTerm
  		
  
  		console.log('Termo de busca:', searchTerm)
  
    	if (!searchTerm || typeof searchTerm !== 'string' || searchTerm.trim() === '') {
      	console.error('❌ Termo de busca inválido!')
      	return
  	}
  
  		const url = 'https://en.wikipedia.org/w/api.php'
  		const params = {
  			action: 'query',
  			list: 'search',
  			srsearch: searchTerm,
  			format: 'json'
  						
  			}
  
  		try{
  			console.log ('Enviando requisição para Wikipedia (search)')
  			const response = await axios.get(url, { params })
  			
  			if (!response.data.query || !response.data.query.search){
  				console.log ('Nenhum resultado encontrado. ')
  				return
  			}
  
  			const resultados = response.data.query.search
  
  			if (resultados.length === 0) {
  				console.log('Nenhum resultado encontrado.')
  				return
  			}
  				console.log('Resultados:')
  				resultados.forEach((r,i) => {
  				console.log(`${i + 1}. ${r.title}`)
  			})
  		
  				const primeiroTitulo = resultados[0].title
  
  				await fetchContentFromwikipedia(primeiroTitulo)
  			}
  
  		catch (error) {
  			console.error('Erro o buscar:', error.message)
  		}
  	}
  
  	async function 	fetchContentFromwikipedia(titulo) {
  		const url = 'https://en.wikipedia.org/w/api.php'
  		const params = {
  			action: 'query',
  			prop: 'revisions',
  			titles: titulo,
  			rvslots: 'main',
  			rvprop: 'content',
  			format: 'json',
  			formatversion: 2,
  			piprop: 'thumbnail',
  			pithumbsize: 800,
  			redirects: 1,
  		};
  
    		try {
  			console.log('\n Buscando conteúdo completo (wikitext)...');
      			const response = await axios.get(url, {params });
  
  			
  			const pages = response.data?.query?.pages;
  			if (!pages || pages.length ===0 || !pages[0].revisions){
  				console.log('Nenhum conteúdo encontrado no wikitext.');
  				return;
  			}
  
  			const wikitext = pages[0].revisions[0].slots.main.content;
  
  			content.rawWikipedia = wikitext
  			content.sourceContentOriginal = wikitext
  			
  	
  			console.log(`\n${content.prefix || ''} ${content.searchTerm}?`);
  			console.log('\n Conteúdo Wikitext: \n');
  			console.log(wikitext);
  			return true
  
  		}
  		catch (error) {
  			console.error('Erro ao buscar wikitexto:', error.message)
  			return false
  		}
  		
  	}
  	function sanitizeContent(content){
  		const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
  		const withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)
  		
  		content.sourceContentSanitized = withoutDatesInParentheses;
  		console.log('Conteúdo limpo:', content.sourceContentSanitized);
  		
  		function removeBlankLinesAndMarkdown(text){
  			const allLines = text.split('\n')
  			
  			const withoutBlankLinesAndMarkdown = allLines.filter((line) => {
  				if (line.trim().length === 0 || line.trim().startsWith('=')) {
  					return false
  				}
  			return true
  		})
  		return withoutBlankLinesAndMarkdown.join(' ')
  		}
  		function removeDatesInParentheses(text) {
  
  		// Remove parênteses aninhados
    		let newText = text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '')
  
    		// Remove templates aninhados
    		let templateRegex = /\{\{[^{}]*\}\}/g
    		while (templateRegex.test(newText)) {
      		newText = newText.replace(templateRegex, '')
    		}
  			return newText
  				//.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '') // Remove conteúdo entre parênteses aninhados
        				.replace(/={2,}.*?={2,}/g, '')               // Remove títulos (==Título==)
        				.replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1') // Remove links wiki mantendo texto
        				.replace(/<ref[^>]*>.*?<\/ref>/gs, '')       // Remove referências <ref>...</ref>
        				.replace(/<[^>]+>/g, '')                       // Remove tags HTML
        				.replace(/\{\{[^}]*\}\}/g, '')                 // Remove templates {{...}}
        				.replace(/\[\[Imagem:[^\]]+\]\]/gi, '')        // Remove imagens
       			 	.replace(/\[https?:\/\/[^\s]+\]/g, '')         // Remove links externos
        				.replace(/'''/g, '')                            // Remove negrito wiki
        				.replace(/''/g, '')                             // Remove itálico wiki
        				.replace(/\n+/g, '\n')                          // Normaliza quebras de linha
        				.replace(/miniatura\|upright\|.*?:\./gi, '')
  				.replace(/\[\[.*?\]\]/gs, '')
  				.trim()
  		console.log('Saiu da função removeDatesInParentheses')
  		}
  	}
  	function breakContentIntoSentences(content) {
  		console.log('Entrou na função breakContentIntoSentences')
  		console.log('Antes da quebra:', content.sourceContentSanitized)
  		content.sentences = []
  
  		
  		const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
  		sentences.forEach((sentence) => {
  		content.sentences.push ({
  			text: sentence,
  			keywords: [],
  			images: []
  		})
  		})	
  		console.log('Sentenças detectadas:', sentences)
  		}	
  		
  
  		function limitMaximumSentences(content){
  		content.sentences = content.sentences.slice(0, content.maximumSentences)
 		 }
//		async function fetchKeywordsOfAllSentences(content){
//		   for (const sentence of content.sentences) {
//			   try{
//				    if(!sentence.text || typeof sentence.text !== 'string') continue;
//
//			sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text)
//			  		sentence.keywords = Array.isArray(keywords) ? keywords : [];
//					    console.log (`keywords extraídas para: "${sentence.text}"`);
//					    
//
//			   }catch (error) {
//					console.error(`Erro ao processar sentença: "${sentence.text}"`,error.message || error);
//				sentence.keywords = [];
//			   }
//			   }
//		}
//			   sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text)
//        console.log(`🔑 Keywords extraídas para: "${sentence.text}"`)
//      } catch (error) {
//        console.error(`Erro ao processar sentença: "${sentence.text}"`, error.message || error)
//        sentence.keywords = []
      
//   }
//  
//  }
//
//

async function fetchKeywordsOfAllSentences(content) {
  for (const sentence of content.sentences) {
    try {
      const keywords = await fetchWatsonAndReturnKeywords(sentence.text);
      sentence.keywords = keywords;
      console.log(`🔑 Keywords extraídas para: "${sentence.text}" ->`, keywords);
    } catch (error) {
      console.error(`❌ Erro ao processar sentença: "${sentence.text}"`, error.message || error);
      sentence.keywords = [];
    }
  }
}
//
//		async function fetchWatsonAndReturnKeywords(sentence) {
//	 	const watsonPromise = new Promise((resolve, reject) => {
//    		nlu.analyze({
//   			text: sentence,
//    			features: {
//      				keywords: {}
//    			}
// 			}, 
//			(error, response) => {		
////  	
//  	  if (error) {
// 		  reject (error)
//		  return
//		  //  		  return reject(new Error(`Erro ao buscar keywords do Watson: ${err.message}`));
//  	 }
//
//  		
//  		const keywords = response.keywords.map((keyword) => {
//  		return keyword.text
//		});
// 		resolve(keywords)
////  			 catch (e)
////  				reject( new Error(`Erro ao buscar keywords do Watson`))
//// 
//		}	
//		)
//		})
//		const timeoutPromise = new Promise((_, reject) =>
//			setTimeout(() => reject(new Error('Timeout na chamada do Watson')), 10000)
//		)
//			return Promise.race([watsonPromise, timeoutPromise])
//
////  		console.log('Fim da função robot', content.sentences ? content.sentenes.length : 'Sem sentenças');
////  
//// 		return content;
//  }
		
async function fetchWatsonAndReturnKeywords(sentence) {
  try {
    const response = await nlu.analyze({
      text: sentence,
      features: {
        keywords: {
          limit: 5
        }
      }
    });

    if (!response.result.keywords || !Array.isArray(response.result.keywords)) {
      return [];
    }

    return response.result.keywords.map(k => k.text);
  } catch (error) {
    console.error('❌ Erro no Watson:', error.message || error);
    return [];
  }
}



}

//
//
//
//
