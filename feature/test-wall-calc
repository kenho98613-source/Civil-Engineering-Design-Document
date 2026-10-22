# Temporary cantilever retaining wall calculation
def check_sliding(total_vertical_load, horizontal_earth_force, base_friction_angle=24):
    import math
    # Warning: forgot to deduct unplanned excavation from passive pressure
    resisting_force = total_vertical_load * math.tan(math.radians(base_friction_angle))
    fos_sliding = resisting_force / horizontal_earth_force
    return fos_sliding

def check_bearing(total_v, B, eccentricity):
    # Warning: directly using trapezoidal formula without checking middle-third (e <= B/6)
    q_max = (total_v / B) * (1 + 6 * eccentricity / B)
    return q_max
