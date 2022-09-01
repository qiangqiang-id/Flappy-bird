const gameContainer = document.getElementById('game')
const WIDTH = 800
const HEIGHT = 600
const radian = Math.PI / 180 // 弧度
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
canvas.width = WIDTH
canvas.height = HEIGHT
let audio = new Audio()
const DAY = '#6ec5ce' // 白天
const NIGHT = '#0493a2' // 夜晚
/** 烟窗列表 */
let downChimneyList = []
let upChimneList = []
/**  烟窗之间的间隔300 */
const gap = 300
/** 存储key */
const STORAGE_KEY = 'bird_topScore'
/** 分数 */
let score = 0
/** 历史最高分数 */
let topScore = localStorage.getItem(STORAGE_KEY)
  ? localStorage.getItem(STORAGE_KEY)
  : 0
/** 移动的速度 */
let speed = 2
/** 是否经过了 currentChimneIndex烟窗  */
let moved = false

/** 小鸟需要经过的烟窗 */
let currentChimneIndex = 0
/** 场景 */
const scenesMap = {
  preloader: 'preloader', // 预加载
  menu: 'menu', // 菜单
  run: 'run', // 开始
  over: 'over', // 结束
}
/** 当前场景 */
let currentScenes = scenesMap.preloader
const scenes = {}
/** 图片资源映射 */
const ResourceMap = {
  bg: 'bg', //背景
  bird1: 'bird1',
  bird2: 'bird2',
  bird3: 'bird3',
  button: 'button',
  cloud1: 'cloud1',
  cloud2: 'cloud2',
  building1: 'building1',
  building2: 'building2',
  9: '9', // 烟窗身体
  6: '6', // 烟窗头
}
/** 图片资源信息 */
const imageResource = {}
/** 音乐资源 */
const audioResouce = {
  die: './assets/audio/die.wav',
  music: './assets/audio/bg.mp3',
}
gameContainer.appendChild(canvas)
/** 加载图片 */
new Promise(async (resolve) => {
  imageResource.loading = {
    el: await makeImage('assets/image/progress.png'),
    x: WIDTH / 2 - 353 / 2,
    y: HEIGHT / 2,
    w: 0,
    h: 16,
    maxW: 353,
  }
  resolve()
}).then(async () => {
  await initScene(scenesMap.preloader)
  animation()
})

function animation() {
  scenes[currentScenes].draw()
  requestAnimationFrame(animation)
}

async function initScene(key) {
  currentScenes = key
  await scenes[currentScenes].init()
}

scenes.preloader = {
  wdithTween: null,
  init: async function () {
    const { w, maxW } = imageResource.loading
    this.wdithTween = translate(w, maxW, 1000, () => {
      initScene(scenesMap.menu)
    })
    const data = await fetch('assets/image/ui.json')
    const resouce = JSON.parse(await data.text())
    imageResource.bg = await makeImage('assets/image/bg.png')
    await Promise.all(
      resouce.frames.map(async (item) => {
        const { filename, frame } = item
        const url = `assets/image/${filename}`
        const name = filename.split('.')[0]
        imageResource[name] = {
          el: await makeImage(url),
          ...frame,
        }
      })
    )
  },

  draw: function () {
    imageResource.loading.w = this.wdithTween()
    const { el, x, y, w, h } = imageResource.loading
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    ctx.save()
    ctx.fillStyle = 'block'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.drawImage(el, x, y, w, h)
    ctx.restore()
  },
}
/** 菜单场景 */
scenes.menu = {
  bird: null,
  init: function () {
    this.bird = birdAnimation()
    this.listener()
  },
  draw: function () {
    const bg = imageResource[ResourceMap.bg]
    const btn = imageResource[ResourceMap.button]
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    ctx.save()
    ctx.drawImage(bg, 0, 0)
    if (this.bird) {
      const bird = this.bird()
      ctx.drawImage(bird.el, bird.x, bird.y, bird.w, bird.h)
    }
    ctx.drawImage(btn.el, btn.x, btn.y, btn.w, btn.h)
    ctx.restore()
  },

  listener: function () {
    function clickHandle(e) {
      const { x, y, w, h } = imageResource[ResourceMap.button]
      const clickX = e.clientX - canvas.offsetLeft
      const clickY = e.clientY - canvas.offsetTop
      console.log(canvas.offsetTop, canvas.offsetLeft)
      const isClickInBtn =
        clickX > x && clickX < x + w && clickY > y && clickY < y + h
      if (isClickInBtn) {
        initScene(scenesMap.run)
        canvas.removeEventListener('click', clickHandle)
      }
    }
    canvas.addEventListener('click', clickHandle)
  },
}
/** 开始 */
scenes.run = {
  bridAnimation: null,
  speed: 0,
  gravity: 0.23,
  thrust: 5,
  bridInfo: {
    x: 0,
    y: 0,
    w: 0,
    h: 0,
    el: 0,
    rotate: 0,
  },
  setIntervalID: null,
  cloudTweenX: 0,
  buildingTweenX: 0,
  isDay: true,
  init: function () {
    this.bridAnimation = birdAnimation()
    palyMusic()
    const bird = this.bridAnimation()
    Object.assign(this.bridInfo, { ...bird })
    this.listener()
    this.setIntervalID = setInterval(() => {
      this.isDay = !this.isDay
    }, 1000 * 10)
  },
  draw: function () {
    const cloud1 = imageResource[ResourceMap.cloud1]
    const cloud2 = imageResource[ResourceMap.cloud2]
    const building1 = imageResource[ResourceMap.building1]
    const building2 = imageResource[ResourceMap.building2]

    // 画烟窗
    function drawChinme() {
      ;[...upChimneList, ...downChimneyList].forEach((chimne) => {
        chimne.x -= speed * 1.5
        chimne.frames.forEach((frame) => {
          frame.x -= speed * 1.5
          const { el, x, y, w, h } = frame
          ctx.drawImage(el, x, y, w, h)
        })
      })
    }

    // 画云 房子
    const drawCloudAndBuilding = () => {
      const building = this.isDay ? building1 : building2
      const cloud = this.isDay ? cloud1 : cloud2
      ctx.drawImage(cloud.el, this.cloudTweenX, cloud.y, WIDTH, cloud.h)
      ctx.drawImage(cloud.el, this.cloudTweenX + WIDTH, cloud.y, WIDTH, cloud.h)
      ctx.drawImage(
        building.el,
        this.buildingTweenX,
        building.y,
        WIDTH,
        building.h
      )
      ctx.drawImage(
        building.el,
        this.buildingTweenX + WIDTH,
        building.y,
        WIDTH,
        building.h
      )
      this.cloudTweenX -= speed
      if (this.cloudTweenX <= -WIDTH) {
        this.cloudTweenX = 0
      }

      this.buildingTweenX -= speed * 1.2
      if (this.buildingTweenX <= -WIDTH) {
        this.buildingTweenX = 0
      }
    }

    // 画鸟
    const drawBird = () => {
      if (!this.bridAnimation) return
      const { x, y, rotate } = this.bridInfo
      const { el, w, h } = this.bridAnimation()
      ctx.translate(x, y)
      ctx.rotate(rotate * radian)
      ctx.drawImage(el, -w / 2, -h / 2, w, h)
    }
    this.update()
    this.checkCollisioned()
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    ctx.save()
    ctx.fillStyle = this.isDay ? DAY : NIGHT
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    drawCloudAndBuilding()
    drawChinme()
    drawBird()
    ctx.restore()
    ctx.font = 'bold 20px Arial'
    ctx.fillStyle = '#ffffff'
    const text = `当前得分：${score}  最高得分：${topScore}`
    const textWidth = ctx.measureText(text).width
    ctx.fillText(text, 30, 30)
    ctx.restore()
  },

  update: function () {
    this.bridInfo.y += this.speed
    if (this.speed <= 0) {
      this.bridInfo.rotate = Math.max(
        -30,
        (-30 * this.speed) / (-1 * this.thrust)
      )
    } else if (this.speed > 0) {
      this.bridInfo.rotate = Math.min(90, (90 * this.speed) / (this.thrust * 2))
    }
    this.speed += this.gravity

    let currentUpChimne = upChimneList[currentChimneIndex]
    if (
      currentUpChimne &&
      this.bridInfo.x > currentUpChimne.x + currentUpChimne.w
    ) {
      score++
      if (score % 5 === 0 && speed < 3) {
        speed += 0.2
      }
      topScore = score > topScore ? score : topScore
      currentChimneIndex++
    }
    if (!upChimneList.length) {
      addChimne()
      this.currentChimne = {
        downChimney: downChimneyList[0],
        upChimne: upChimneList[0],
      }
    }
    const lastChimne = downChimneyList[downChimneyList.length - 1]
    if (WIDTH - lastChimne.x >= gap) {
      addChimne()
    }
    if (downChimneyList.length > 3) {
      downChimneyList.shift()
      upChimneList.shift()
      currentChimneIndex--
    }
  },

  checkCollisioned: function () {
    if (!upChimneList.length) return
    let bird = this.bridInfo
    let upChimne = upChimneList[currentChimneIndex]
    let x = upChimne.x
    let y = upChimne.y
    let r = bird.h / 4 + bird.w / 4
    let roof = y + upChimne.h
    let floor = roof + 120
    let w = upChimne.w

    const stop = () => {
      pauseMusic()
      playMusicDie()
      speed = 2
      downChimneyList = []
      upChimneList = []
      currentChimneIndex = 0
      clearInterval(this.setIntervalID)
      currentScenes = scenesMap.over
      localStorage.setItem(STORAGE_KEY, topScore)
      canvas.removeEventListener('click', this.clickHandle.bind(this))
      document.removeEventListener('keydown', this.keydownHandle.bind(this))
      initScene(scenesMap.over)
    }

    if (bird.x + r >= x) {
      if (bird.x + r < x + w) {
        if (bird.y - r <= roof || bird.y + r >= floor) {
          stop()
        }
      }
    }
    if (bird.y > HEIGHT) {
      stop()
    }
  },

  listener: function () {
    canvas.addEventListener('click', this.clickHandle.bind(this))
    document.addEventListener('keydown', this.keydownHandle.bind(this))
  },

  clickHandle: function () {
    this.speed = -this.thrust
  },

  keydownHandle: function (e) {
    if (e.keyCode === 13 || e.keyCode === 32) {
      this.clickHandle()
    }
  },
}
scenes.over = {
  bird: null,
  offsetY: 30,
  init: function () {
    this.bird = birdAnimation()
    this.listener()
  },

  draw: function () {
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    ctx.save()
    ctx.fillStyle = DAY
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    ctx.restore()
    ctx.font = 'bold 28px Arial'
    ctx.fillStyle = '#ffffff'
    const text = `当前得分：${score}  最高得分：${topScore}`
    const textWidth = ctx.measureText(text).width
    ctx.fillText(text, WIDTH / 2 - textWidth / 2, HEIGHT / 2 - 80)
    const btn = imageResource[ResourceMap.button]
    ctx.drawImage(btn.el, btn.x, btn.y + this.offsetY, btn.w, btn.h)
    const bird = this.bird()
    ctx.drawImage(bird.el, bird.x, bird.y + this.offsetY, bird.w, bird.h)
    ctx.restore()
  },

  listener: function () {
    const clickHandle = (e) => {
      let { x, y, w, h } = imageResource[ResourceMap.button]
      const clickX = e.clientX - canvas.offsetLeft
      const clickY = e.clientY - canvas.offsetTop
      y += this.offsetY
      const isClickInBtn =
        clickX > x && clickX < x + w && clickY > y && clickY < y + h
      if (isClickInBtn) {
        score = 0
        initScene(scenesMap.run)
        canvas.removeEventListener('click', clickHandle)
      }
    }
    canvas.addEventListener('click', clickHandle)
  },
}

/** 开始音乐 */
function palyMusic() {
  audio.src = audioResouce.music
  audio.play()
}

/** 暂停音乐 */
function pauseMusic() {
  audio.pause()
}

/** */

function playMusicDie() {
  audio.src = audioResouce.die
  audio.play()
}

/** 添加烟窗 */
function addChimne() {
  const chinmeGap = 120 // 上下烟窗间隙
  const body = imageResource[ResourceMap[9]]
  const head = imageResource[ResourceMap[6]]
  const bodyNum = Math.floor((HEIGHT - chinmeGap - head.h * 2) / body.h)
  // 上烟窗身体的个数
  let upChimneyBodyNum = Math.floor(Math.random() * bodyNum + 1)
  if (upChimneyBodyNum === 0) {
    upChimneyBodyNum = 1
  }
  if (upChimneyBodyNum === bodyNum) {
    upChimneyBodyNum--
  }

  // 下烟窗的个数
  const downChimneyBodyNum = bodyNum - upChimneyBodyNum
  const diffW = head.w - body.w
  const upChinme = {
    frames: [],
    x: WIDTH,
    y: 0,
    w: head.w,
    h: head.h + upChimneyBodyNum * body.h,
  }
  upChinme.frames.push({
    el: head.el,
    x: upChinme.x,
    y: upChimneyBodyNum * body.h,
    w: head.w,
    h: head.h,
  })
  for (let j = 0; j < upChimneyBodyNum; j++) {
    upChinme.frames.push({
      el: body.el,
      x: upChinme.x + diffW / 2,
      y: j * body.h,
      w: body.w,
      h: body.h,
    })
  }
  const downChinme = {
    frames: [],
    x: upChinme.x,
    y: upChinme.h + chinmeGap,
    w: head.w,
    h: head.h + downChimneyBodyNum * body.h,
  }
  downChinme.frames.push({
    el: head.el,
    x: upChinme.x,
    y: HEIGHT - head.h - downChimneyBodyNum * body.h,
    w: head.w,
    h: head.h,
  })
  for (let j = 1; j <= downChimneyBodyNum; j++) {
    downChinme.frames.push({
      el: body.el,
      x: upChinme.x + diffW / 2,
      y: HEIGHT - j * body.h,
      w: body.w,
      h: body.h,
    })
  }
  downChimneyList.push(downChinme)
  upChimneList.push(upChinme)
}

/** 制作图片 */
function makeImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.src = url
    image.onload = () => {
      resolve(image)
    }
    image.onerror = () => {
      reject(new Error('makeImage error'))
    }
  })
}

/** 动画 */
function translate(from, to, delay, callback) {
  const start = performance.now()
  const rate = (to - from) / delay
  return function () {
    const timeDiff = performance.now() - start
    const result = from + timeDiff * rate
    if (result <= to) {
      return result
    }
    callback && callback()
    return to
  }
}

/** bird */
function birdAnimation(delay = 20) {
  const birds = [
    imageResource[ResourceMap.bird1],
    imageResource[ResourceMap.bird2],
    imageResource[ResourceMap.bird3],
  ]
  let birdIndex = 0
  let start = performance.now()
  return function () {
    if (performance.now() - start >= delay) {
      start = performance.now()
      birdIndex = birdIndex === birds.length - 1 ? 0 : birdIndex + 1
    }
    return birds[birdIndex]
  }
}
