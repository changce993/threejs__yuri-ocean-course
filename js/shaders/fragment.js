export default `
  varying float vNoise;
  varying vec2 vUv;
  uniform float time;
  uniform sampler2D uImage;
  uniform float hoverState;

  void main() {
    vec2 newUV = vUv;
    
    vec2 p = newUV;
    float x = hoverState;
    x = smoothstep(.0,1.0,(x*2.0+p.y-1.0));

    vec4 f = mix(
      texture2D(uImage, (p-.5)*(1.-x)+.5),
      texture2D(uImage, (p-.5)*x+.5),
      x
    );

    vec4 textureView = texture2D(uImage, newUV);

    // gl_FragColor = vec4(finalColor,1);
    gl_FragColor = vec4(vUv,0.,1.);
    // gl_FragColor = textureView;
    // gl_FragColor = vec4(vNoise,0.,0.,1.);
    gl_FragColor = f;
    gl_FragColor.rgb += 0.15*vec3(vNoise);
  }
`;