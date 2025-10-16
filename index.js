const readline = require('readline-sync')
const robots = {
	userInput: require('./robots/user-input.js'),
	text: require('./robots/text.js'),
	state: require('./robots/state.js'),
	image: require('./robots/image.js')
}

async function start() {
	
	robots.userInput()
//	content.maximumSentences = 7
//	console.log('Conteúdo inicial:', content)
	await robots.text()
	await robots.image()

	const content = robots.state.load()
	console.dir(content, {depth: null } )
//	console.log(JSON.stringify(content, null, 4))
//	console.log(content)
}

start ()
