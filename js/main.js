import '../style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import vertex from './shaders/vertex';
import fragment from './shaders/fragment';
import image from '../images/layout.jpeg';
import imagesLoaded from 'imagesloaded';
import FontFaceObserver from 'fontfaceobserver';
import Scroll from './scroll';
import gsap from 'gsap';

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

export default class Sketch {
  constructor(options) {
    this.time = 0;
    this.dom = options.dom;
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(70, this.vw/this.vh, 100, 2000);
    this.camera.position.z = 600;
    this.camera.fov = 2 * Math.atan((this.vh / 2) / 600) * (180 / Math.PI);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2))
    this.renderer.setSize(this.vw, this.vh);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);

    this.images = [...document.querySelectorAll("img")];

    const fontOpen = new Promise(resolve => {
      new FontFaceObserver("Open Sans").load().then(() => {
        resolve();
      })
    })

    const fontPlayFair = new Promise(resolve => {
      new FontFaceObserver("Playfair Display").load().then(() => {
        resolve();
      })
    })

    const preloadImages = new Promise((resolve, reject) => {
      imagesLoaded(document.querySelectorAll("img"), { background: true }, resolve)
    })

    const allDone = [fontOpen, fontPlayFair, preloadImages];
    this.currentScroll = 0;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    Promise.all(allDone).then(() => {
      this.scroll = new Scroll()
      this.addImages();
      this.setPosition();
      this.resize();
      this.setupResize();
      // this.addObject();
      this.mouseMovement();
      this.composerPass();
      this.render();

      // window.addEventListener("scroll", () => {
      //   this.currentScroll = window.scrollY;
      //   this.setPosition();
      // })
    })
  }

  composerPass() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    let counter = 0;

    this.myEffect= {
      uniforms: {
        tDiffuse: { value: null },
        scrollSpeed: { value: null },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float scrollSpeed;
        varying vec2 vUv;
        void main() {
          vec2 newUv = vUv;
          float area = smoothstep(4., 0., vUv.y);
          area = pow(area, 4.);
          newUv.x -= (vUv.x - 0.5)*.1*area*scrollSpeed;
          gl_FragColor = texture2D(tDiffuse, newUv);
          // gl_FragColor = vec4(area, 0, 0, 1);
        }
      `
    }

    this.customPass = new ShaderPass(this.myEffect);
    this.customPass.renderToScreen = true;
    this.composer.addPass(this.customPass);
  }

  mouseMovement() {
    window.addEventListener("mousemove", (e) => {
      this.mouse.x = (e.clientX / this.vw) * 2 - 1;
      this.mouse.y = (e.clientY / this.vh) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      
      const intersects = this.raycaster.intersectObjects(this.scene.children);
      // console.log(intersects)

      if(intersects.length > 0) {
        // console.log(intersects[0].uv);
        const obj = intersects[0].object;
        obj.material.uniforms.hover.value = intersects[0].uv;
      }
    }, false);
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.vw = window.innerWidth;
    this.vh = window.innerHeight;
    this.renderer.setSize(this.vw, this.vh);
    this.camera.aspect = this.vw/this.vh;
    this.camera.updateProjectionMatrix();
  }

  addImages() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        uImage: { value: 0 },
        hover: { value: new THREE.Vector2(.5, .5) },
        hoverState: { value: 0 },
        imageTexture: { value: new THREE.TextureLoader().load(image) },
      },
      side: THREE.DoubleSide,
      fragmentShader: fragment,
      vertexShader: vertex,
      // wireframe: true
    });

    this.materials = [];

    this.imageStorage = this.images.map(img => {
      const { top, left, width, height } = img.getBoundingClientRect();
      
      const geometry = new THREE.PlaneBufferGeometry(width, height, 100, 100);
      const texture = new THREE.TextureLoader().load(img.src)
      texture.needsUpdate = true;
      // const material = new THREE.MeshBasicMaterial({
      //   // color: 0xff0000,
      //   map: texture
      // });

      const material = this.material.clone();
      material.uniforms.uImage.value = texture;

      img.addEventListener("mouseenter", () => {
        gsap.to(material.uniforms.hoverState, {
            duration: 1,
            value: 1,
            ease: "power3.out"
        })
      })

      img.addEventListener("mouseout", () => {
        gsap.to(material.uniforms.hoverState, {
            duration: 1,
            value: 0,
            ease: "power3.out"
        })
      })

      this.materials.push(material);

      const mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);

      return { img, mesh, top, left, width, height };
    });
  };

  setPosition() {
    this.imageStorage.forEach(img => {
      img.mesh.position.y = this.currentScroll -img.top + this.vh/2 - img.height/2;
      img.mesh.position.x = img.left - this.vw/2 + img.width/2;
    })
  }

  addObject() {
    this.geometry = new THREE.PlaneBufferGeometry(200, 400, 10, 10);
    // this.geometry = new THREE.SphereBufferGeometry(2, 40, 40);
    this.material = new THREE.MeshNormalMaterial();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        imageTexture: { value: new THREE.TextureLoader().load(image) },
      },
      side: THREE.DoubleSide,
      fragmentShader: fragment,
      vertexShader: vertex,
      wireframe: true
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  render() {
    this.time += .01;
    // this.material.uniforms.time.value = this.time;
    this.materials.forEach(material => material.uniforms.time.value = this.time);
    this.scroll.render();
    this.currentScroll = this.scroll.scrollToRender;
    this.setPosition();
    this.customPass.uniforms.scrollSpeed.value = this.scroll.speedTarget;
    this.renderer.render(this.scene, this.camera);
    this.composer.render();
    requestAnimationFrame(this.render.bind(this));
  }
};

new Sketch({ dom: document.querySelector("#canvas") });
