const readline = require('readline-sync')
const robots = {
	userInput: require('./robots/user-input.js'),
	text: require('./robots/text.js')
}

async function start() {
	
	let content = robots.userInput()
	content.maximumSentences = 7
	console.log('Conteúdo inicial:', content)
	await	robots.text(content)
	console.log(JSON.stringify(content, null, 4))
//	console.log(content)
}

start ()
