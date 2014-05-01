var passport = require('passport');
var Strategy = require('passport-linkedin-oauth2').Strategy;
var tokenizer = require('./utils/tokenizer');
var User = require(__appbase_dirname + '/models/model-user');
var linkedinInfo = require('./utils/oauth-info').linkedin;

var initialize = function (router) {
    setPassportStrategy();
    setRouter(router);
};

var setRouter = function (router) {
    // login (authenticate)
    router.get('/auth/login/linkedin',
            passport.authenticate('linkedin', {
                'state' : 'DCEEFWF45453sdffef424' 
            }));

    router.get('/auth/login/linkedin/callback',
            passport.authenticate('linkedin', {
                successRedirect: '/auth/login/linkedin/callback/success',
                failureRedirect: '/auth/login/linkedin/callback/failure'
            })
    );

    router.get('/auth/login/linkedin/callback/:state', function (req, res) {
        if (req.params.state == 'success') {
            res.render('auth_popup', {
                state: 'success',
                data: req.user.access_token
            });
        } else {
            res.render('auth_popup', { 
                state: 'failure', 
                data: {
                    message: "LinkedIn authentication failed :("
                }
            });
        }
    });

    // connect to current session
    router.get('/auth/connect/linkedin',
            passport.authenticate('linkedin', {
                'state' : 'DCEEFWF45453sdffef424' 
            }));

    // disconnect from current session
    router.get('/auth/disconnect/linkedin',
            function (req, res) {
                console.log('disconnect linkedin');
                if (!req.user) {
                    res.send(401, { reason: 'not-authenticated' });
                } else {
                    var user = req.user;
                    user.linkedin = undefined;
                    console.log('linkedin info: ' + req.user.linkedin);
                    user.save(function (err) {
                        if (err) {
                            console.error(err);
                        }
                        res.json({ token: user.access_token });
                    });
                }
    });
};

var setPassportStrategy = function () {
    passport.use(new Strategy({
        clientID: linkedinInfo.apiKey,
        clientSecret: linkedinInfo.secretKey,
        callbackURL: linkedinInfo.callbackURL,
        scope: [ 'r_fullprofile', 'r_emailaddress' ],
        passReqToCallback: true
    }, function (req, token, refreshToken, profile, done) {
        // TODO How about using process.nextTick() for code below
        User.findOne({ 'linkedin.id' : profile.id },
            function (err, user) {
                if (err) {
                    console.error(err);
                    return done(err);
                }

                if (user) {
                    console.log('linkedin user already exists!');
                    return done(null, user);
                }

                var changedUser;
                if (req.user) {
                    console.log('already logined user!');
                    changedUser = req.user;
                } else {
                    console.log('not yet logined user!');
                    changedUser = new User();
                    try {
                        changedUser.access_token =
                             tokenizer.create(changedUser._id);
                    } catch(err) {
                        // TODO need to handle error properly
                        console.log(err);
                    }
                }

                // append linkedin profile
                changedUser.linkedin.id = profile.id;
                changedUser.linkedin.token = token;
                changedUser.linkedin.refreshToken = refreshToken;
                changedUser.linkedin.displayName = profile.displayName;
                changedUser.linkedin.email = profile.emails[0].value;
                changedUser.linkedin.industry = profile._json.industry;
                changedUser.linkedin.headline = profile._json.headline;
                changedUser.linkedin.photo = profile._json.pictureUrl;
                changedUser.save(function (err) {
                    if (err) {
                        console.error(err);
                        return done(err);
                    }
                    return done(null, changedUser);
                });
            }
        );
    }));
};

module.exports = initialize;
