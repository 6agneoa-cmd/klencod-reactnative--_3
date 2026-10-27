extends Node2D

const WORLD_SIZE := Vector2(1152, 648)
const PLAYER_SPEED := 210.0
const SURVIVE_TIME := 60.0

var player_pos := Vector2(100, 560)
var enemy_pos := Vector2(1020, 90)
var last_known_pos := player_pos
var exit_pos := Vector2(1080, 560)

var hiding_spots: Array[Rect2] = [
	Rect2(220, 120, 130, 95),
	Rect2(520, 410, 130, 95),
	Rect2(820, 150, 130, 95)
]
var hide_visits: Array[int] = [0, 0, 0]

var current_spot := -1
var is_hiding := false
var escape_experience := 0.0
var elapsed := 0.0
var exit_open := false
var game_over := false
var won := false
var status_message := "Survive. Do not repeat your hiding places."

var move_touch_id := -1
var touch_start := Vector2.ZERO
var touch_direction := Vector2.ZERO


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			if game_over or won:
				restart_game()
			elif event.position.x < WORLD_SIZE.x * 0.5 and move_touch_id == -1:
				move_touch_id = event.index
				touch_start = event.position
				touch_direction = Vector2.ZERO
		elif event.index == move_touch_id:
			move_touch_id = -1
			touch_direction = Vector2.ZERO

	elif event is InputEventScreenDrag and event.index == move_touch_id:
		touch_direction = ((event.position - touch_start) / 70.0).limit_length(1.0)

	if event is InputEventKey and event.pressed and event.keycode == KEY_R:
		restart_game()


func _process(delta: float) -> void:
	if not game_over and not won:
		update_game(delta)

	queue_redraw()


func update_game(delta: float) -> void:
	elapsed += delta

	var direction := get_movement_direction()
	player_pos += direction * PLAYER_SPEED * delta
	player_pos.x = clampf(player_pos.x, 25.0, WORLD_SIZE.x - 25.0)
	player_pos.y = clampf(player_pos.y, 60.0, WORLD_SIZE.y - 25.0)

	update_hiding(direction)
	update_enemy(direction, delta)

	if elapsed >= SURVIVE_TIME:
		exit_open = true
		status_message = "The exit is open. Reach the green door."

	if exit_open and player_pos.distance_to(exit_pos) < 42.0:
		won = true

	if enemy_pos.distance_to(player_pos) < 28.0:
		if not is_hiding or favorite_hideout() != -1:
			game_over = true
			status_message = "It learned your behavior."


func get_movement_direction() -> Vector2:
	if touch_direction.length() > 0.05:
		return touch_direction

	var direction := Vector2.ZERO

	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		direction.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		direction.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		direction.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		direction.y += 1.0

	return direction.normalized()


func update_hiding(direction: Vector2) -> void:
	var spot := get_spot_at(player_pos)
	is_hiding = spot != -1 and direction.length() < 0.1

	if is_hiding:
		if current_spot != spot:
			hide_visits[spot] += 1
			current_spot = spot
	elif spot == -1:
		current_spot = -1


func get_spot_at(position_to_check: Vector2) -> int:
	for i in range(hiding_spots.size()):
		if hiding_spots[i].has_point(position_to_check):
			return i
	return -1


func favorite_hideout() -> int:
	var best_spot := -1
	var highest_visits := 1

	for i in range(hide_visits.size()):
		if hide_visits[i] > highest_visits:
			highest_visits = hide_visits[i]
			best_spot = i

	return best_spot


func update_enemy(direction: Vector2, delta: float) -> void:
	var target := player_pos
	var favorite := favorite_hideout()
	var away_direction := (player_pos - enemy_pos).normalized()

	# يتعلم أن اللاعب يهرب في اتجاه ثابت عند اقتراب الخطر.
	if player_pos.distance_to(enemy_pos) < 350.0:
		if direction.length() > 0.1 and direction.dot(away_direction) > 0.65:
			escape_experience = minf(escape_experience + delta * 20.0, 100.0)

	if is_hiding:
		if favorite != -1:
			target = hiding_spots[favorite].get_center()
			status_message = "It found your favorite hiding place."
		else:
			target = last_known_pos
	else:
		last_known_pos = player_pos

		# بعد اكتساب خبرة كافية، يستهدف وجهتك بدل مكانك الحالي.
		if escape_experience > 25.0 and direction.length() > 0.1:
			target = player_pos + direction * 170.0
			status_message = "It is predicting where you will run."

	var enemy_direction := (target - enemy_pos).normalized()
	var enemy_speed := 115.0 + minf(elapsed * 0.35, 35.0)
	enemy_pos += enemy_direction * enemy_speed * delta


func restart_game() -> void:
	player_pos = Vector2(100, 560)
	enemy_pos = Vector2(1020, 90)
	last_known_pos = player_pos
	hide_visits = [0, 0, 0]
	current_spot = -1
	is_hiding = false
	escape_experience = 0.0
	elapsed = 0.0
	exit_open = false
	game_over = false
	won = false
	status_message = "Survive. Do not repeat your hiding places."
	touch_direction = Vector2.ZERO
	move_touch_id = -1


func _draw() -> void:
	var font := ThemeDB.fallback_font

	draw_rect(Rect2(Vector2.ZERO, WORLD_SIZE), Color("11131a"))

	for x in range(0, int(WORLD_SIZE.x), 64):
		draw_line(Vector2(x, 0), Vector2(x, WORLD_SIZE.y), Color("1b1e28"))
	for y in range(0, int(WORLD_SIZE.y), 64):
		draw_line(Vector2(0, y), Vector2(WORLD_SIZE.x, y), Color("1b1e28"))

	var favorite := favorite_hideout()

	for i in range(hiding_spots.size()):
		var spot_color := Color("29344a")
		if i == favorite:
			spot_color = Color("632f3b")

		draw_rect(hiding_spots[i], spot_color)
		draw_rect(hiding_spots[i], Color("7185aa"), false, 2.0)
		draw_string(
			font,
			hiding_spots[i].position + Vector2(10, 25),
			"HIDING %d" % [i + 1],
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			16,
			Color.WHITE
		)

	var exit_color := Color("40bd78") if exit_open else Color("363b45")
	draw_rect(Rect2(exit_pos - Vector2(25, 40), Vector2(50, 80)), exit_color)

	draw_circle(enemy_pos, 20.0, Color("d74455"))
	draw_circle(enemy_pos + Vector2(-6, -3), 3.0, Color.WHITE)
	draw_circle(enemy_pos + Vector2(6, -3), 3.0, Color.WHITE)

	var player_color := Color("61758a") if is_hiding else Color("53cde0")
	draw_circle(player_pos, 17.0, player_color)

	draw_string(font, Vector2(25, 35), status_message, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color.WHITE)
	draw_string(
		font,
		Vector2(900, 35),
		"TIME: %d" % int(elapsed),
		HORIZONTAL_ALIGNMENT_LEFT,
		-1,
		22,
		Color.WHITE
	)

	if move_touch_id != -1:
		draw_circle(touch_start, 70.0, Color(1, 1, 1, 0.08))
		draw_circle(touch_start + touch_direction * 45.0, 25.0, Color(1, 1, 1, 0.25))

	if game_over or won:
		draw_rect(Rect2(Vector2.ZERO, WORLD_SIZE), Color(0, 0, 0, 0.75))
		var result := "YOU ESCAPED" if won else "IT FOUND YOU"
		draw_string(font, Vector2(390, 290), result, HORIZONTAL_ALIGNMENT_LEFT, -1, 48, Color.WHITE)
		draw_string(
			font,
			Vector2(370, 345),
			"Tap the screen or press R to restart",
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			22,
			Color.WHITE
		)
		