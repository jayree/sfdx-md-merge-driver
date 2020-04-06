import * as fs from 'fs'
import * as path from 'path'
import * as es from 'event-stream'
import * as xml2js from 'xml2js'

const regProfile = /.*<Profile xmlns/
const regPSet = /.*<PermissionSet xmlns/
const regLabel = /.*<CustomLabels xmlns/

const builder = new xml2js.Builder({
  xmldec: {version: '1.0', encoding: 'UTF-8'},
  renderOpts: {pretty: true, indent: '    ', newline: '\n'},
  xmlns: true,
})

async function getMetafromFile(file) {
  return new Promise(resolve => {
    let output
    const s = fs
      .createReadStream(file)
      .pipe(es.split())
      .pipe(
        es.mapSync(function(line) {
          switch (true) {
            case regProfile.test(line):
              output = 'Profile'
              s.destroy()
              break
            case regPSet.test(line):
              output = 'PermissionSet'
              s.destroy()
              break
            case regLabel.test(line):
              output = 'CustomLabels'
              s.destroy()
              break
          }
        }),
      )
      .on('close', () => {
        resolve(output)
      })
  })
}

function getConfigPath(meta) {
  return path.join(
    __dirname,
    '..',
    '..',
    '/conf/merge-' + meta.toLowerCase() + '-config.json',
  )
}

export async function getMetaConfigJSON(meta) {
  return new Promise(resolve => {
    let output = ''
    //   const s = fs
    //     .createReadStream(getConfigPath(meta))
    //     .pipe(es.parse())
    //     .on('end', data => {
    //       resolve(data)
    //     })
    fs.createReadStream(getConfigPath(meta))
      .pipe(
        es.mapSync(function(data) {
          // console.log(data)
          output = output.concat(data)
        }),
      )
      .on('end', () => {
        const jsonO = JSON.parse(output)
        const result = {uniqueKeys: {}, exclusiveUniqueKeys: {}}
        for (const x of Object.keys(jsonO)) {
          // result[x] =
          jsonO[x].uniqueKeys === undefined
            ? (result.exclusiveUniqueKeys[x] = jsonO[x].exclusiveUniqueKeys)
            : (result.uniqueKeys[x] = jsonO[x].uniqueKeys)
        }
        resolve(result)
      })
  })
}

export async function getMetadataType(files: string[]) {
  const tabPromise = []
  let output
  for (const key of files) {
    tabPromise.push(getMetafromFile(key))
  }
  await Promise.all(tabPromise)
    .then(data => {
      data = data.filter((el, i, a) => el !== undefined && i === a.indexOf(el))
      if (data.length > 1) {
        // eslint-disable-next-line no-throw-literal
        throw 'multiple metadataTypes given as input'
      }
      output = data.filter(
        (el, i, a) => el !== undefined && i === a.indexOf(el),
      )[0]
    })
    .catch(error => {
      throw error
    })
  return output
}

/* function getNodeBaseXML(meta) {
  switch (meta) {
    default:
      return '<?xml version="1.0" encoding="UTF-8"?><'.concat(meta).concat(' xmlns="http://soap.sforce.com/2006/04/metadata"></').concat(meta).concat('>')
  }
} */

function getNodeBaseJSON(meta) {
  const result = {}
  switch (meta) {
    default:
      result[meta] = {$: {xmlns: 'http://soap.sforce.com/2006/04/metadata'}}
      return result
    // return JSON.parse('{"' + meta + '":{ "$": { "xmlns": "http://soap.sforce.com/2006/04/metadata" }}}')
  }
}

/* async function getNodes(file, meta) {
  const tmpFile = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  if (tmpFile.length === 0) {
    return {}
    // tmpFile = getNodeBaseXML(meta)
  }
  let result
  new xml2js.Parser().parseString(tmpFile, (e, r) => {
    result = r
  })
  return result[meta]
}

async function getNodes2(file, meta) {
  return new Promise(resolve => {
    let output = ''
    fs.createReadStream(file)
      .pipe(
        es.mapSync(function (data) {
          // console.log(data)
          output = output.concat(data)
        }),
      )
      .on('end', () => {
        if (output.length > 0) {
          xml2js.parseString(output, (e, r) => {
            resolve(r[meta])
          })
        } else {
          resolve({})
        }
        // resolve(result)
      })
  }).then(result => {
    // console.log(JSON.stringify(result["applicationVisibilities"]))
    result["_fileName"] = file
    return result
  })
} */

async function getNodes3(file, meta) {
  return new Promise(resolve => {
    let output = ''
    if (fs.statSync(file).size === 0) {
      resolve({})
    } else {
      fs.createReadStream(file)
        .pipe(
          es.mapSync(function(data) {
            // console.log(data)
            output = output.concat(data)
          }),
        )
        .on('end', () => {
          // if (output.length > 0) {
          xml2js.parseString(output, (e, r) => {
            resolve(r[meta])
          })
          // } else {
          //   resolve({})
          // }
          // resolve(result)
        })
    }
  }).then(result => {
    // console.log(JSON.stringify(result["applicationVisibilities"]))
    // result["_fileName"] = file
    return result
  })
}

export async function getFiles(files: string[], meta) {
  const tabPromise = []
  let output
  for (const key of files) {
    tabPromise.push(getNodes3(key, meta))
  }
  await Promise.all(tabPromise)
    .then(data => {
      output = data
    })
    .catch(error => {
      throw error
    })
  return output
}

export async function writeOutput(meta, file, jsonOutput) {
  const base = getNodeBaseJSON(meta)
  Object.assign(base[meta], jsonOutput)
  fs.writeFileSync(file, builder.buildObject(base))
}
