'use strict'
require('dotenv').config()
const path = require('path')
const express = require('express')
const myDB = require('./connection')
const fccTesting = require('./freeCodeCamp/fcctesting.js')
const session = require('express-session')
const passport = require('passport')
const { ObjectId } = require('mongodb')
const LocalStrategy = require('passport-local')

const app = express()

fccTesting(app) // For FCC testing purposes
app.set('view engine', 'pug')

app.use('/public', express.static(path.join(__dirname, 'public')))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
  cookie: { secure: false }
}))

app.use(passport.initialize())
app.use(passport.session())

myDB(async (client) => {
  const database = await client.db('database').collection('users')

  app.route('/').get((req, res) => {
    res.render(path.join(__dirname, '/views/pug/index'), {
      title: 'Connected to database',
      message: 'Please Login',
      showLogin: true,
      showRegistration: true
    })
  })

  app.route('/login').post(passport.authenticate('local', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile')
  })

  const ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
      return next()
    }
    res.redirect('/')
  }

  app.route('/profile').get(ensureAuthenticated, (req, res) => {
    res.render(path.join(__dirname, '/views/pug/profile'), {
      username: req.user.username
    })
  })

  app.route('/logout').get((req, res) => {
    req.logout()
    res.redirect('/')
  })

  app.route('/register').post((req, res, next) => {
    database.findOne({ username: req.body.username }, (err, user) => {
      if (err) {
        next(err)
      } else if (user) {
        res.redirect('/')
      } else {
        database.insertOne({
          username: req.body.username,
          password: req.body.password
        }, (err, doc) => {
          if (err) {
            res.redirect('/')
          } else {
            next(null, doc.ops[0])
          }
        })
      }
    })
  })

  app.use((req, res, next) => {
    res.status(404).type('text').send('404 Not Found')
  })

  passport.serializeUser((user, done) => {
    done(null, user._id)
  })

  passport.deserializeUser((id, done) => {
    database.findOne({ _id: new ObjectId(id) }, (err, doc) => {
      if (err) {
        return done(null, false)
      }
      done(null, doc)
    })
  })

  passport.use(new LocalStrategy((username, password, done) => {
    database.findOne({ username }, (err, user) => {
      console.log(`User "${username}" attempted to login.`)
      if (err) {
        return done(err)
      }
      if (!user || password !== user.password) {
        return done(null, false)
      }
      return done(null, user)
    })
  }))
}).catch((err) => {
  app.route('/').get((req, res) => {
    res.render(path.join(__dirname, '/views/pug/index'), {
      title: err,
      message: 'Unable to login!'
    })
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('Listening on port ' + PORT)
})
