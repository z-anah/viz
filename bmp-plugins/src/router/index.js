import { createRouter, createWebHistory } from 'vue-router'

const modules = import.meta.glob('../views/*.vue')

const kebabCase = (str) =>
  str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase()

const dynamicRoutes = Object.keys(modules).map((path) => {
  const fileName = path.split('/').pop().replace(/\.vue$/, '')
  const routePath = fileName === 'Home' ? '/' : `/${kebabCase(fileName)}`

  return {
    path: routePath,
    name: fileName,
    component: modules[path]
  }
})

const router = createRouter({
  history: createWebHistory(),
  routes: dynamicRoutes
})

export default router