const imageDownloader = require('image-downloader')
const gm = require('gm').subClass({ imageMagick:true })
const google = require('googleapis').google
const customSearch = google.customsearch('v1')
const state = require('./state.js')
const path = require('path')
const axios = require('axios')
const fs = require('fs')

const googleSearchCredentials = require('../credentials/google-search.json')
const maxImages = 8

async function robot(){
	const content = state.load()

	
	content.sentences = content.sentences.map(sentence => {
		if (sentence.keywords.length <= 2) {
			sentence.keywords = [] // limpa keywords curtas
		}
		return sentence
	}).filter(sentence => sentence.keywords.length > 0) // remove sentenças sem keywords válidas
	
	await fetchImagesOfAllSentences(content)
	await downloadAllImages(content)
	await convertAllImages(content)
	await createAllSentenceImages(content)
	await createYouTubeThumbnail()



      state.save(content)

	async function fetchImagesOfAllSentences(content){
		const validSentences = []

	for (const sentence of content.sentences) {
		const query = `${content.searchTerm} ${sentence.keywords[0]}`
		const images = await fetchGoogleAndReturnImagesLinks(query)
		
		if (images.length >= 3){
		sentence.images = images.filter(link => typeof link === 'string' && link.trim() !== '')
		sentence.googleSearchQuery = query
		validSentences.push(sentence)
		}else{
			console.warn(`Sentença descartada: "${sentence.text}" (apenas ${images.length} imagens encontradas)`)
		}
	}
		content.sentences = validSentences
	}



	async function fetchGoogleAndReturnImagesLinks(query){
	try {
	const response = await customSearch.cse.list({
	auth: googleSearchCredentials.apiKey,
	cx: googleSearchCredentials.searchEngineId,
	q: query,
	searchType: 'image',
	num: 10//,
//	rights: 'cc_publicdomain'	

	})

//	const imagesUrl = response.data.items.map((item) => {
//		return item.link
//	})

//	const items = response.data.items ?? [] 
//	const normalize = (url) => {
		if (!response.data || !response.data.items) {
			console.warn(`nenhum resultado retornado para: "${query}"`)
			return[]
		}
//		let clean = url.split("?")[0].toLowerCase()
//		clean = clean.replace(/\/\d+px-/, "/")
//		return clean
//	}	

	//	return item.link
	//})
	const imagesUrl = Array.from(new Set(
		response.data.items
		.map(item => item.link)
		.filter(link =>!!link && link.startsWith('http'))
		.filter(link => /\.(jpe?g|png|gif|webp)$/i.test(link))

	))

//			if (!link) return false
//			const cleanLink = normalize(link)
//			return /\.(jpg|jpeg|png|gif|webp|bmp|tiff|svg)$/i.test(cleanLink) 
//		})
//			.map(link => normalize(link))
//			.filter(link => !!link)
//			.filter(link => link.startsWith("http"))
//	))
		return imagesUrl
	} catch (error){
		console.error(`Erro ao buscar imagens no google para "${query}":`, error.message)
		return[]
	}
	}
	async function downloadAllImages(content) {
		content.downloadedImages = []
		let totalDownloaded = 0;	

		for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++){
			
			const images = content.sentences[sentenceIndex].images
				let downloaded = false;

			for (let imageIndex = 0; imageIndex < images.length; imageIndex++){
				const imageUrl = images[imageIndex]

				  try {
					  if (content.downloadedImages.includes(imageUrl)){
						throw new Error('Imagem já foi baixada')
					  }
				
			const isValid = await isImageUrl(imageUrl)
				  if (!isValid) {
					throw new Error('Link não é uma imagem válida')
				  }
				await downloadAndSave(imageUrl, `${sentenceIndex}-original.png`)
				
				content.downloadedImages.push(imageUrl)
				console.log(`> [${sentenceIndex}][${imageIndex}] Baixou imagem com sucesso: ${imageUrl}`)
				downloaded = true
				totalDownloaded++
					  
			if (totalDownloaded >= maxImages){
			console.log(`> Limite de ${maxImages} imagens atingido, parando downloads.`);
			content.totalDownloaded = totalDownloaded
				return;
			}


			  break
			} catch(error) {
				console.log(`> [${sentenceIndex}][${imageIndex}] Erro ao baixar (${imageUrl}): ${error}`)
			}
		}
			if (!downloaded) {
			console.warn(`Nenhuma imagem válida para sentença ${sentenceIndex}, usando imagem padrão.`)
				try {
			const placeholder = 'https://via.placeholder.com/1920x1080?text=Sem+Imagem';
				await downloadAndSave(placeholder, `${sentenceIndex}-original.png`);
				totalDownloaded++

			if (totalDownloaded >= maxImages){
			console.log(`> Limite de ${maxImages} imagens atingido, parando downloads.`);
			content.totalDownloaded = totalDownloaded	
				return;
			}

				}catch (err){
					console.error(`Erro ao baixar a imagem padrão: ${err.message}.`)
					//const fs = require('fs')
					//const emptyPath = path.resolve(__dirname, `../content/${sentenceIndex}-original.png`)

					//fs.writeFileSync(emptyPath, '')
					process.exit(1)
				}

			}
	  } 
		content.totalDownloaded = totalDownloaded
	}
	async function downloadAndSave(url, fileName) {

		const dir = path.resolve(__dirname, '../content')

		return imageDownloader.image({
		url, url,
		dest: `${dir}/${fileName}`,			
		headers: {
     			'User-Agent': 'Mozilla/5.0'
		}
		})
}
	async function isImageUrl(url) {
		try {
			
				const response = await axios.head(url,{
				headers: {
				'User-Agent': 'Mozilla/5.0'
				},
				maxRedirects:5,
				validateStatus: null
			})
			const contentType = response.headers['content-type'] || ''
			return contentType.startsWith('image/')
		} catch (error) {
			return false
		}
	}
	async function convertAllImages(content){
		for (let sentenceIndex = 0; sentenceIndex < content.totalDownloaded; sentenceIndex++) {
			await convertImage(sentenceIndex)
		}
	}
	async function convertImage(sentenceIndex) {
		return new Promise((resolve, reject) => {
			const inputFile = path.resolve(__dirname, `../content/${sentenceIndex}-original.png[0]`)
			const outputFile = path.resolve(__dirname, `../content/${sentenceIndex}-converted.png`)
			const width = 1920
			const height = 1080

			gm() .command('magick')
			.in(inputFile)
			.out('(')
				.out('-clone')
				.out('0')
				.out('-background', 'white')
				.out('-blur', '0x9')
				.out('-resize', `${width}x${height}^`)
			.out(')')
			.out('(')
				.out('-clone')
				.out('0')
				.out('-background', 'white')
				.out('-resize', `${width}x${height}`)
			.out(')')
			.out('-delete', '0')
			.out('-gravity', 'center')
			.out('-compose', 'over')
			.out('-composite')
			.out('-extent', `${width}x${height}`)
			.write(outputFile, (error) => {
			if (error) {
				return reject(error)
			}
			console.log(`> Image converted: ${inputFile}`)
				resolve()
			})
		})
	}

	async function createAllSentenceImages(content) {
		for(let sentenceIndex = 0; sentenceIndex < content.totalDownloaded; sentenceIndex++){
			await createSentenceImage(sentenceIndex, content.sentences[sentenceIndex].text)
		}
	}
	async function createSentenceImage(sentenceIndex, sentenceText){
		return new Promise((resolve, reject) => {
			const outputFile = path.resolve(__dirname, `../content/${sentenceIndex}-sentence.png`)

			const templateSettings = {
			0: {
				size: '1920x400',
				gravity: 'center'
			},
			1: {
				size: '1920x1080',
				gravity: 'center'
			},
			2: {
				size: '800x1080',
				gravity: 'west'
			},
			3: {
				size: '1920x400',
				gravity: 'center'
			},
			4: {
				size: '1920x1080',
				gravity: 'center'
			},
			5: {
				size: '800x1080',
				gravity: 'west'
			},
			6: {
				size: '1920x400',
				gravity: 'center'
			},
			7: {
				size: '1920x1080',
				gravity: 'center'	
			}	
			}
			gm()
			.command('magick')
			.out('-size', templateSettings[sentenceIndex].size)
			.out('-gravity', templateSettings[sentenceIndex].gravity)
			.out('-background', 'transparent')
			.out('-fill', 'white')
			.out('-kerning', '-1')
			.out(`caption: ${sentenceText}`)
			.write(outputFile, (error) => {
			if (error) {
				return reject(error)
			}
			console.log(`> Sentence created: ${outputFile}`)
				resolve()
			})


		})
	}

	async function createYouTubeThumbnail(){
		return new Promise  ((resolve, reject) =>{
			gm()
				.command('magick')
				.in(`./content/0-converted.png`)
				.write(`./content/youtube-thumbnail.jpg`, (error) => {
					if (error) {
						return reject(error)
					}
				console.log('> Creating YouTube thumbnail')
				resolve()	
				})
		})

	}

}
module.exports = robot
