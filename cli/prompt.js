import inquirer from 'inquirer'

export async function ask (questions) {
  return inquirer.prompt(questions)
}
